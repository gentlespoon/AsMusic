function sniffImageMime(data: Uint8Array): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** True when bytes look like a real image (rejects Navidrome zero-fill placeholders). */
export function isValidImageBytes(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  return sniffImageMime(data) !== null;
}

/** MIME type suitable for `<img src="blob:...">` from cached or network artwork bytes. */
export function artworkDisplayMimeType(data: Uint8Array, declared?: string): string {
  const sniffed = sniffImageMime(data);
  const d = declared?.split(';')[0]?.trim().toLowerCase();
  if (d && d.startsWith('image/') && d !== 'image/octet-stream') {
    return d;
  }
  return sniffed ?? 'image/jpeg';
}
