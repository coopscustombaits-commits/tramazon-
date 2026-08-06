import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type UploadMetadata,
} from 'firebase/storage';

import { storage } from '@/lib/firebase';

/**
 * Upload a local file (an `ImagePicker` URI) to Cloud Storage.
 *
 * React Native has no `File`, so we go through `fetch` to get a Blob. This is
 * the supported path for the Firebase JS SDK on RN.
 */
export async function uploadImage(
  localUri: string,
  storagePath: string,
  metadata?: UploadMetadata,
): Promise<{ url: string; storagePath: string }> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('Could not read the selected image.');
  }
  const blob = await response.blob();

  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, blob, {
    contentType: blob.type || 'image/jpeg',
    ...metadata,
  });

  return { url: await getDownloadURL(objectRef), storagePath };
}

/** Best-effort delete; a missing object is not an error worth surfacing. */
export async function deleteImage(storagePath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Already gone, or rules deny it — nothing useful to do here.
  }
}

/** Unique-enough file name that keeps the original extension. */
export function imageFileName(localUri: string, prefix = 'img'): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(localUri);
  const extension = (match?.[1] ?? 'jpg').toLowerCase();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}
