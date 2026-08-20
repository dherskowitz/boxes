import imageCompression from 'browser-image-compression'

const OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true
}

/**
 * Shrink a camera photo before upload.
 *
 * The primary target is a phone on a slow connection, and v1 caches images for
 * offline reads — a raw multi-megabyte camera file would blow both budgets.
 * The library returns a Blob-ish File that can lose the original name, so the
 * name is restored explicitly.
 */
export async function compressImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, OPTIONS)
  if (compressed.name === file.name) return compressed
  return new File([compressed], file.name, { type: compressed.type })
}

export function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage))
}
