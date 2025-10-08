import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export type UploadKind = 'image' | 'video';

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export function buildIntranetPath(kind: UploadKind, originalName: string) {
  const ts = Date.now();
  const safe = sanitizeFileName(originalName);
  const folder = kind === 'image' ? 'intranet/images' : 'intranet/videos';
  return `${folder}/${ts}_${safe}`;
}

export function uploadIntranetFile(file: File, kind: UploadKind, onProgress?: (pct: number) => void): Promise<{ url: string; path: string }> {
  return new Promise((resolve, reject) => {
    const path = buildIntranetPath(kind, file.name);
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    task.on('state_changed', (snap) => {
      const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
      onProgress?.(Math.round(pct));
    }, reject, async () => {
      try {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function deleteIntranetFile(path: string) {
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    // Si no existe o permisos, ignorar silenciosamente
    console.warn('No se pudo eliminar del storage:', e);
  }
}
