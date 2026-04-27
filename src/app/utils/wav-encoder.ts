/**
 * Encodes a Web Audio API AudioBuffer to a standard 16-bit PCM WAV Blob.
 * Samples are clipped to [-1, 1] before quantisation.
 */
export function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate   = audioBuffer.sampleRate;
  const numSamples   = audioBuffer.length;
  const bitsPerSample = 16;
  const blockAlign   = (numChannels * bitsPerSample) / 8;
  const byteRate     = sampleRate * blockAlign;
  const dataLength   = numSamples * blockAlign;
  const totalLength  = 44 + dataLength;

  const buffer = new ArrayBuffer(totalLength);
  const view   = new DataView(buffer);

  writeString(view,  0, 'RIFF');
  view.setUint32 ( 4, totalLength - 8, true);
  writeString(view,  8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32 (16, 16, true);            // Subchunk1Size (PCM)
  view.setUint16 (20,  1, true);            // AudioFormat   (1 = PCM)
  view.setUint16 (22, numChannels, true);
  view.setUint32 (24, sampleRate, true);
  view.setUint32 (28, byteRate, true);
  view.setUint16 (32, blockAlign, true);
  view.setUint16 (34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32 (40, dataLength, true);

  // Interleave channels: L R L R …
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Creates a temporary anchor element and triggers a file download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
