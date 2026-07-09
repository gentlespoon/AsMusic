const PLACEHOLDER_SIZE = 512;

/** Embedded 128×128 PNG fallback when canvas is unavailable (tests, SSR). */
const EMBEDDED_PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAE0UlEQVR42u3dR3bjMBBFUa3H2VYOnfa/BU96Jepjmk0zIFSJBRPA/4OaenKf5WOiIK7u7p6u+nm+3t9r5+X68KCd12YeHzXz1szTk3TWg3l+lsxmMC8vktlO5vU1NrvJvL3FZu+c9do9K+Lj4q/XB20AxK8JXxkA8WvDVwRA/BrxhQEQv1Z8QQDErxk/EgDxa8cPBEB8BPzNxhkA8VHwHQEQHwl/FADx0fB7ARAfEb8NgPio+E0AxMfF32yO2gCIXxO+MgDi14avCID4NeILAyB+rfiCAIhfM34kAOLXjh8IgPgI+J4AiI+Cv91OAiA+Ev4oAOKj4fcCID4ifhsA8aX47+9/F5lU+E0AxJf/5ucQgCX+dnvSBoD9sb90ANb4ygD4N3/JAFLgKwIg/pIBpMIXBkD8PAOYjy8IgPh5BmCDHwmA+HkGYIcfCID4roc8ywdgi+8JgPi+J3zLBmCPv9tNAiB+6PHucgGkwR8FQPzYs/0cA5iD3wuA+JKDHR/Qx4HOEgHMxW8DIL70VC8UQMoIUuF3ARBfdqQbCuD/Ee53BGCFv9udryviy8/z/c/qh+f4KQOwxFcGwGUOaQDWEaTCVwRAfF0An8e3lgGkwBcGQHxdAMPtHYsAUuELAiC+LgD3/p59ADb4kQCIrwsgvMBpF4AdfiAA4usCiG/v2gRgi+8JgPi+1W1tAONz/HkB2OM7AiB+aG9fE4Bvjeu2ANLg7/eDAIgfu7RhtbdvGcAc/F4AxJdc2LHc27cIYC5+GwDxpde1rPf25wRggd8FQHzZXb0Ue/u3BGCFv99friviyy9qptrb1wRgia8IgPj6AHRrXJIArPGFARBfH8BtO3yhAFLgCwIgvj6AeQucrp+fCj8SAPH1Aczf3pUFYIMfCID4+gDsVrfDAdjhewLAONW75WtZvnNv3x2ALb4jAIwdPs3XsUiOdFPt7Q8DsMcfBVD36rbFN3Mssbf/GUAa/MOhC6DeSxuWlzOX2NtPid8GQHxpBEvs7afEnwRA/Pz29lPiHw4/vgIgfp57+ynxuwCIn+/efkr8JgDi5723nxJfGEDd/+qlCaAMfEEAxF96bz8lfiSAsq5o5xFAWfiBAOp6vPs9AZSH7wmgzCvaywZQJr4jAOJbB5Az/iiAsq9o5xhA7vi9AMq/op1bACXgH49NAHVc0c4pgFLwJwGUfEU7lwBKwj8ef34FUMMtXX7s6/C7AGq5pcuPfR1+E0BtFzWJL8cXBlDeXT3iy/AFAZR7XYv4cfxIAOXf2CF+GD8QQHnv0iW+Ht8TQNkvUua/enJ8RwB1vUUb7WBHiz8KAOcV6qWvcVnh9wLAwS95gdMa/3RqAiA+Kr4zAOLj4J9Ov4YBEB8LfxAA8fHwuwCIj4nfBEB8XHxBAMSvGT8SAPFrxw8EQHwEfE8AxEfBdwRAfCT8UQDER8PvBUB8RPw2AOKj4p/PjgCIj4N/Pv8eBkB8LPxBAMTHw+8CID4mfhMA8XHxBQEQv2b8SADErx0/EADxEfA9ARAfBd8RAPGR8EcBEB8NvxcA8RHx2wCIj4p/uXgCID4G/uXyZxoA8XHwJwEQHwt/EADx8fC7AIiPid8EQHxc/EAAxEfA9wRAfBR8RwDER8IfBUB8NPxeAMRHxP+Yf3MPxpKq2zHeAAAAAElFTkSuQmCC';

type PlaceholderAssets = {
  dataUrl: string;
  base64: string;
  bytes: Uint8Array;
};

let cachedPlaceholder: PlaceholderAssets | null = null;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function fromEmbeddedBase64(): PlaceholderAssets {
  const bytes = base64ToUint8Array(EMBEDDED_PLACEHOLDER_PNG_BASE64);
  return {
    dataUrl: `data:image/png;base64,${EMBEDDED_PLACEHOLDER_PNG_BASE64}`,
    base64: EMBEDDED_PLACEHOLDER_PNG_BASE64,
    bytes,
  };
}

function generatePlaceholderViaCanvas(): PlaceholderAssets | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = PLACEHOLDER_SIZE;
  canvas.height = PLACEHOLDER_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
  gradient.addColorStop(0, '#3d3d42');
  gradient.addColorStop(1, '#2a2a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);

  ctx.fillStyle = '#dcdce0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '280px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('♬', PLACEHOLDER_SIZE / 2, PLACEHOLDER_SIZE / 2 + 12);

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] ?? '';
  if (!base64) return null;

  return {
    dataUrl,
    base64,
    bytes: base64ToUint8Array(base64),
  };
}

/** Shared music-note placeholder used in UI and lock-screen artwork. */
export function getDefaultCoverArtPlaceholder(): PlaceholderAssets {
  if (cachedPlaceholder) return cachedPlaceholder;

  try {
    const generated = generatePlaceholderViaCanvas();
    if (generated) {
      cachedPlaceholder = generated;
      return generated;
    }
  } catch (error) {
    console.warn('[AsMusic] cover art placeholder canvas generation failed', error);
  }

  cachedPlaceholder = fromEmbeddedBase64();
  return cachedPlaceholder;
}

export function getDefaultCoverArtPlaceholderDataUrl(): string {
  return getDefaultCoverArtPlaceholder().dataUrl;
}

export function getDefaultCoverArtPlaceholderBase64(): string {
  return getDefaultCoverArtPlaceholder().base64;
}

export function logCoverArtUnavailable(
  failure: import('./types').CoverArtLoadFailure,
): void {
  console.warn('[AsMusic] cover art unavailable', failure);
}
