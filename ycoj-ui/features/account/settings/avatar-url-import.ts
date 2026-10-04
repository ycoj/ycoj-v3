export const AVATAR_MAX_BYTES = 8 * 1024 * 1024;

export function isAvatarImportUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function avatarImageType(
  bytes: Uint8Array
): 'image/png' | 'image/jpeg' | undefined {
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte
    )
  )
    return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg';
}

function imageDimensions(bytes: Uint8Array, type: 'image/png' | 'image/jpeg') {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png') {
    if (
      bytes.length < 24 ||
      String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR'
    )
      throw new Error('type');
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) break;
    let marker = bytes[offset++];
    while (marker === 255 && offset < bytes.length) marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) break;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      if (length < 7) break;
      return {
        width: view.getUint16(offset + 5),
        height: view.getUint16(offset + 3),
      };
    }
    offset += length;
  }
  throw new Error('type');
}

export async function importAvatarUrl(value: string): Promise<File> {
  if (!isAvatarImportUrl(value)) throw new Error('url');
  const response = await fetch(value, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body) throw new Error('download');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > AVATAR_MAX_BYTES) throw new Error('size');
      chunks.push(new Uint8Array(chunk));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const type = avatarImageType(bytes);
  if (!type) throw new Error('type');
  const { width, height } = imageDimensions(bytes, type);
  if (
    !width ||
    !height ||
    width > 4096 ||
    height > 4096 ||
    width * height > 16_000_000
  )
    throw new Error('type');
  const bitmap = await createImageBitmap(new Blob([bytes], { type }));
  try {
    if (
      bitmap.width > 4096 ||
      bitmap.height > 4096 ||
      bitmap.width * bitmap.height > 16_000_000
    )
      throw new Error('type');
    // Re-encoding produces a static raster and removes untrusted metadata and trailing payloads.
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('type');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) throw new Error('type');
    if (blob.size > AVATAR_MAX_BYTES) throw new Error('size');
    return new File([blob], 'avatar.png', { type: 'image/png' });
  } finally {
    bitmap.close();
  }
}
