import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import pdf from "pdf-parse";
import { callGemini, getTextEmbedding } from "./aiHelpers";

const db = admin.firestore();
const storage = admin.storage();
const geminiApiKey = defineSecret("GEMINI_API_KEY"); // sólo para declarar dependencia del secreto

interface DocMeta {
  title: string;
  description?: string;
  tags?: string[];
  storagePath: string; // gs:// o ruta relativa al bucket
  contentType?: string;
  contentText?: string; // texto extraído
  pageCount?: number;
  createdBy: string; // email
  createdAt: FirebaseFirestore.FieldValue | string;
}

interface DocChunk {
  docId: string;
  idx: number; // índice del chunk en el doc
  title: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  embedding: number[]; // vector embedding
  tags?: string[];
  createdAt: FirebaseFirestore.FieldValue | string;
}

// Seguridad básica: sólo Subdirección puede indexar y gestionar
function assertSubdireccion(context: any) {
  if (!context.auth) throw new HttpsError("unauthenticated", "Requiere autenticación.");
  const profile = context.auth.token?.profile;
  if (profile !== "SUBDIRECCION") throw new HttpsError("permission-denied", "Sólo Subdirección puede realizar esta acción.");
}

// Carga bytes de un archivo desde Storage
async function downloadFileBytes(storagePath: string): Promise<Buffer> {
  // storagePath puede venir como "documentacion/ID/filename.pdf" o "gs://bucket/documentacion/..."
  let bucket = storage.bucket();
  let filePath = storagePath;
  if (storagePath.startsWith("gs://")) {
    const url = new URL(storagePath);
    bucket = admin.storage().bucket(url.host);
    // url.pathname comienza con '/'
    filePath = url.pathname.replace(/^\//, "");
  }
  const file = bucket.file(filePath);
  const [buf] = await file.download();
  return buf as Buffer;
}

// Extrae texto de PDF o TXT básico
async function extractText(bytes: Buffer, contentType?: string): Promise<{ text: string; pageCount?: number }> {
  if (contentType?.includes("pdf") || (!contentType && bytes.slice(0, 4).toString("hex").startsWith("25504446"))) {
    const data = await pdf(bytes);
    const text = (data.text || "").replace(/\s+$/g, "").trim();
    return { text, pageCount: data.numpages };
  }
  // Fallback para texto plano
  const asText = bytes.toString("utf8");
  return { text: asText, pageCount: undefined };
}

// Fragmenta el texto en chunks (tamaño aprox) respetando párrafos.
function chunkText(text: string, targetSize = 1200): string[] {
  const paras = text
    .split(/\n{2,}/g)
    .map(p => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > targetSize && buf.length > 0) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? (buf + '\n\n' + p) : p;
    }
  }
  if (buf) chunks.push(buf);

  // fallback: si no hubo párrafos, cortar por longitud
  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += targetSize) {
      chunks.push(text.slice(i, i + targetSize));
    }
  }
  return chunks;
}

// Indexa documento subido: lee archivo del Storage, extrae texto y guarda en Firestore
export const indexDocumentacionDoc = onCall({ secrets: [geminiApiKey] }, async (request) => {
  assertSubdireccion(request);
  const { docId, storagePath, title, description, tags, contentType } = request.data || {};
  if (!docId || !storagePath || !title) {
    throw new HttpsError("invalid-argument", "docId, storagePath y title son requeridos.");
  }
  try {
    const bytes = await downloadFileBytes(storagePath);
    const { text, pageCount } = await extractText(bytes, contentType);
    const meta: Partial<DocMeta> = {
      title,
      description: description || null,
      tags: Array.isArray(tags) ? tags : [],
      storagePath,
      contentType: contentType || null,
      contentText: text || "",
      pageCount: pageCount || null,
      createdBy: request.auth!.token.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    } as any;
    await db.collection("documentacion_docs").doc(docId).set(meta, { merge: true });

    // Indexado por chunks con embeddings
    const chunks = chunkText(text || '', 1200).slice(0, 500); // tope defensivo
    const chunkCol = db.collection('documentacion_chunks');

    // Primero elimina chunks previos de este doc (si los hay) en lotes seguros
    const oldSnap = await chunkCol.where('docId', '==', docId).get();
    if (!oldSnap.empty) {
      let delBatch = db.batch();
      let delOps = 0;
      for (const d of oldSnap.docs) {
        delBatch.delete(d.ref);
        delOps++;
        if (delOps >= 450) {
          await delBatch.commit();
          delBatch = db.batch();
          delOps = 0;
        }
      }
      if (delOps > 0) await delBatch.commit();
    }

    // Crea embeddings por chunk (secuencial) y escribe en batches rotativos
    let idx = 0;
    let batch = db.batch();
    let ops = 0;
    for (const c of chunks) {
      const { embedding } = await getTextEmbedding(c);
      const ref = chunkCol.doc();
      const payload: Partial<DocChunk> = {
        docId,
        idx,
        title: title,
        text: c,
        embedding,
        tags: Array.isArray(tags) ? tags : [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, payload);
      ops++;
      idx++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    return { ok: true, characters: (text || "").length, pageCount: pageCount || 0 };
  } catch (err: any) {
    console.error("[indexDocumentacionDoc] Error:", err);
    throw new HttpsError("internal", err?.message || "Error al indexar documento");
  }
});

// Buscador muy simple por palabras clave para top-K documentos
// scoreDoc (legacy) ya no se usa con embeddings

function buildPrompt(
  question: string,
  docs: Array<{ idx: number; title: string; text: string }>,
  history?: Array<{ role: 'user' | 'assistant'; text: string }>,
): string {
  const historyText = Array.isArray(history) && history.length > 0
    ? `Historial reciente (máx 4 turnos):\n${history.slice(-4).map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`).join('\n')}\n\n`
    : '';
  const ctx = docs
    .map((c) => `Doc ${c.idx}: ${c.title}\n---\n${c.text.substring(0, 1600)}\n`)
    .join("\n\n");
  return `Eres un asistente institucional. Responde solo con el contexto de los documentos listados. Si la respuesta no está en ellos, responde claramente que no hay información suficiente en los documentos.

${historyText}Documentos base:
${ctx}

Pregunta: ${question}

Instrucciones de respuesta:
- Sé breve y claro.
- Si corresponde, cita (Doc N) donde N corresponde al índice indicado arriba.
- No inventes información fuera de los documentos.`;
}

// Nota: App Check deshabilitado temporalmente para no bloquear mientras el cliente
// configura la site key de reCAPTCHA v3. Mantener la verificación de auth.
export const documentacionQuery = onCall({ secrets: [geminiApiKey], /* enforceAppCheck: true */ timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Requiere autenticación.");
  if (!request.app) {
    // Log defensivo: cuando App Check no está presente, aún permitimos la consulta si el usuario está autenticado
    console.warn('[documentacionQuery] App Check token ausente; permitiendo por ahora (solo usuarios autenticados).');
  }
  const { question, topK = 3, tags: tagsFilter, history } = request.data || {};
  if (!question || typeof question !== "string") {
    throw new HttpsError("invalid-argument", "'question' es requerido.");
  }
  try {
    // Nueva consulta basada en embeddings (RAG ligero)
    const { embedding: qVec } = await getTextEmbedding(question);

    // Traer chunks (tope defensivo)
    let chunkQuery: FirebaseFirestore.Query = db.collection('documentacion_chunks');
    const tagList = Array.isArray(tagsFilter) ? tagsFilter.filter(Boolean).slice(0, 10) : [];
    if (tagList.length > 0) {
      chunkQuery = chunkQuery.where('tags', 'array-contains-any', tagList);
    }
    const chunkSnap = await chunkQuery.limit(1000).get();
    const chunks = chunkSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Array<DocChunk & { id: string }>;

    const sim = (a: number[], b: number[]) => {
      const len = Math.min(a.length, b.length);
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
      const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-8;
      return dot / denom;
    };

    const rankedChunks = chunks
      .map(ch => ({
        docId: ch.docId,
        title: ch.title,
        text: ch.text,
        score: Array.isArray(ch.embedding) ? sim(qVec, ch.embedding) : -1,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(3, Math.min(60, Number(topK) * 10 || 30)));

    // Si las similitudes son muy bajas, devolvemos una respuesta explícita
    const bestScore = rankedChunks[0]?.score ?? -1;
    if (bestScore < 0.1) {
      return { ok: true, answer: 'No encuentro información suficiente en los documentos para responder esta consulta.', modelUsed: 'n/a', citations: [] };
    }

    // Agrupar por documento y seleccionar mejores docs y fragmentos
    const byDoc: Record<string, { title: string; chunks: { text: string; score: number }[] }> = {};
    for (const rc of rankedChunks) {
      if (!byDoc[rc.docId]) byDoc[rc.docId] = { title: rc.title, chunks: [] };
      byDoc[rc.docId].chunks.push({ text: rc.text, score: rc.score });
    }
    const docEntries = Object.entries(byDoc)
      .map(([docId, v]) => ({ docId, title: v.title, topChunkScore: Math.max(...v.chunks.map(c => c.score)), chunks: v.chunks.sort((a,b)=>b.score-a.score).slice(0, 2) }))
      .sort((a,b) => b.topChunkScore - a.topChunkScore)
      .slice(0, Math.max(1, Math.min(4, Number(topK) || 3)));

    const contexts = docEntries.map((d, i) => ({ idx: i + 1, title: d.title, text: d.chunks.map(c => c.text).join('\n\n') }));

    // Construir prompt y usar modelo PRO para mayor fidelidad (fallback implícito en helper)
  const prompt = buildPrompt(question, contexts as Array<{ idx: number; title: string; text: string }>, Array.isArray(history) ? history : undefined);
  const { text: aiResponseText, modelUsed } = await callGemini({ prompt, mode: 'standard', config: { maxOutputTokens: 2048, temperature: 0.2 } });

  // Generar citas basadas en los documentos seleccionados
  const citations = docEntries.map((d, i) => ({ index: i + 1, id: d.docId, title: d.title, storagePath: undefined }));

    return { ok: true, answer: aiResponseText, modelUsed, citations };
  } catch (err: any) {
    console.error("[documentacionQuery] Error:", err);
    throw new HttpsError("internal", err?.message || "Error al consultar documentación");
  }
});
