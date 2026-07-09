import { Capacitor } from '@capacitor/core';
import type { CoverArtResolved } from './types.ts';

/** Convert a resolved cover-art payload into an `<img src>` value. */
export function toThumbDisplayUrl(resolved: CoverArtResolved): string | null {
  switch (resolved.kind) {
    case 'disk':
    case 'network_fetch': {
      const blob = new Blob([resolved.data], { type: resolved.mimeType });
      return URL.createObjectURL(blob);
    }
    case 'local_file':
      return Capacitor.convertFileSrc(resolved.localFilePath);
    case 'network_url':
      return resolved.url;
    default:
      return null;
  }
}
