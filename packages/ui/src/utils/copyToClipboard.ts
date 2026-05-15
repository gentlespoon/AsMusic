import type { PlatformHost } from '@asmusic/core';

/** Copy plain text via {@link PlatformHost.clipboard}. */
export async function copyTextToClipboard(
  text: string,
  host: PlatformHost,
): Promise<boolean> {
  return host.clipboard.writeText(text);
}
