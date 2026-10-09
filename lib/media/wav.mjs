/**
 * Minimal, dependency-free WAV writer + DSP helpers.
 * Used to synthesise demo beats so the store is fully playable out of the box.
 */

export function encodeWav(channels, sampleRate) {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let s = channels[c][i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      buffer.writeInt16LE(Math.round(s * 32767), offset);
      offset += 2;
    }
  }
  return buffer;
}

/** Mulberry32 — tiny deterministic PRNG so seeded beats are reproducible. */
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lowpass(cutoff, sampleRate) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = (1 / sampleRate) / (rc + 1 / sampleRate);
  let prev = 0;
  return (sample) => {
    prev = prev + alpha * (sample - prev);
    return prev;
  };
}

export function highpass(cutoff, sampleRate) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = rc / (rc + 1 / sampleRate);
  let prevIn = 0;
  let prevOut = 0;
  return (sample) => {
    const out = alpha * (prevOut + sample - prevIn);
    prevIn = sample;
    prevOut = out;
    return out;
  };
}

/** Simple feedback delay for space. */
export function makeDelay(sampleRate, timeSec, feedback, mix) {
  const size = Math.max(1, Math.floor(sampleRate * timeSec));
  const buffer = new Float32Array(size);
  let idx = 0;
  return (sample) => {
    const delayed = buffer[idx];
    buffer[idx] = sample + delayed * feedback;
    idx = (idx + 1) % size;
    return sample * (1 - mix) + delayed * mix;
  };
}

export function normalize(channel, peak = 0.89) {
  let max = 0;
  for (let i = 0; i < channel.length; i++) {
    const v = Math.abs(channel[i]);
    if (v > max) max = v;
  }
  if (max === 0) return channel;
  const gain = peak / max;
  for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  return channel;
}

export function fade(channel, sampleRate, fadeIn = 0.01, fadeOut = 0.25) {
  const inN = Math.floor(sampleRate * fadeIn);
  const outN = Math.floor(sampleRate * fadeOut);
  for (let i = 0; i < inN && i < channel.length; i++) channel[i] *= i / inN;
  for (let i = 0; i < outN; i++) {
    const idx = channel.length - 1 - i;
    if (idx < 0) break;
    channel[idx] *= i / outN;
  }
  return channel;
}
