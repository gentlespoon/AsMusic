import { WAVEFORM_BAR_COUNT } from './waveformConstants';

/** Decode audio from a fetchable URL into normalized peak samples in `[0, 1]`. */
export async function decodeWaveformPeaks(
  fetchUrl: string,
  barCount: number = WAVEFORM_BAR_COUNT,
): Promise<number[]> {
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Waveform fetch failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    if (channel.length === 0) {
      return Array.from({ length: barCount }, () => 0.2);
    }
    const samplesPerBar = Math.max(1, Math.floor(channel.length / barCount));
    const peaks: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let max = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, channel.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j]!);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / top);
  } finally {
    await ctx.close();
  }
}
