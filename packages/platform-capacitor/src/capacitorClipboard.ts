import { Clipboard } from '@capacitor/clipboard';
import type { ClipboardHost } from '@asmusic/core';

export const capacitorClipboard: ClipboardHost = {
  async writeText(text) {
    const value = text.trim();
    if (!value) return false;
    try {
      await Clipboard.write({ string: value });
      return true;
    } catch {
      return false;
    }
  },
};
