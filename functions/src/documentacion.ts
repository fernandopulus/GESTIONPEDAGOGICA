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
    const batch = db.batch();
    const chunkCol = db.collection('documentacion_chunks');

    // Primero elimina chunks previos de este doc (si los hay)
    const oldSnap = await chunkCol.where('docId', '==', docId).get();
    oldSnap.docs.forEach(d => batch.delete(d.ref));

    // Crea embeddings por chunk (secuencial para evitar throttling)
    let idx = 0;
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
      idx++;
      // Límite defensivo del batch (Firestore máx 500 operaciones)
      if (idx % 450 === 0) {
        await batch.commit();
      }
    }
    await batch.commit();
    return { ok: true, characters: (text || "").length, pageCount: pageCount || 0 };
  } catch (err: any) {
    console.error("[indexDocumentacionDoc] Error:", err);
    throw new HttpsError("internal", err?.message || "Error al indexar documento");
  }
});

// Buscador muy simple por palabras clave para top-K documentos
// scoreDoc (legacy) ya no se usa con embeddings

function buildPrompt(question: string, contexts: Array<{ title: string; text: string }>): string {
  const ctx = contexts
    .map((c, i) => `Documento ${i + 1}: ${c.title}\n---\n${c.text.substring(0, 6000)}\n`)
    .join("\n\n");
  return `Eres un asistente institucional. Responde únicamente usando el contexto provisto (reglamentos, protocolos, documentación interna). Si no hay información suficiente, indica claramente que no está en los documentos.

Contexto:
${ctx}

Pregunta del usuario: ${question}

Responde de forma breve y clara. Si corresponde, cita el/los documentos con (Doc #).`;
}

// Nota: App Check deshabilitado temporalmente para no bloquear mientras el cliente
// configura la site key de reCAPTCHA v3. Mantener la verificación de auth.
export const documentacionQuery = onCall({ secrets: [geminiApiKey], /* enforceAppCheck: true */ timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Requiere autenticación.");
  if (!request.app) {
    // Log defensivo: cuando App Check no está presente, aún permitimos la consulta si el usuario está autenticado
    console.warn('[documentacionQuery] App Check token ausente; permitiendo por ahora (solo usuarios autenticados).');
  }
  const { question, topK = 3, tags: tagsFilter } = request.data || {};
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
      .slice(0, Math.max(3, Math.min(12, Number(topK) * 3 || 9)));

    // Unir por doc para citas
    const seenDocs: Record<string, { title: string; score: number }> = {};
    const contexts = rankedChunks.map((c) => {
      if (!seenDocs[c.docId]) seenDocs[c.docId] = { title: c.title, score: c.score };
      return { title: c.title, text: c.text };
    });

    // Construir prompt y usar modelo PRO para mayor fidelidad (fallback implícito en helper)
    const prompt = buildPrompt(question, contexts);
    const { text: aiResponseText, modelUsed } = await callGemini({ prompt, mode: 'standard', config: { maxOutputTokens: 1024, temperature: 0.2 } });

    // Generar citas deterministas
    const citations = Object.keys(seenDocs).slice(0, Number(topK) || 3).map((docId, i) => ({
      index: i + 1,
      id: docId,
      title: seenDocs[docId].title,
      storagePath: undefined,
    }));

    return { ok: true, answer: aiResponseText, modelUsed, citations };
  } catch (err: any) {
    console.error("[documentacionQuery] Error:", err);
    throw new HttpsError("internal", err?.message || "Error al consultar documentación");
  }
});
