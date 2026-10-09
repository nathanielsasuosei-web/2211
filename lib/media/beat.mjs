/**
 * Tiny procedural beat engine — no external audio needed.
 * Renders a genre-aware arrangement (drums, bass, keys, melody) to PCM
 * buffers so the demo catalogue is genuinely playable in the browser.
 */
import { encodeWav, makeRandom, lowpass, highpass, makeDelay, normalize, fade } from "./wav.mjs";

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentMinor: [0, 3, 5, 7, 10],
};

const NOTE_TO_SEMITONE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

export function parseKey(keyLabel = "A minor") {
  const [note, scaleName = "minor"] = keyLabel.split(/\s+/);
  const semitone = NOTE_TO_SEMITONE[note] ?? 9;
  return { rootMidi: 45 + semitone, scale: SCALES[scaleName] ?? SCALES.minor };
}

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Genre groove templates: 16 steps per bar. */
const GROOVES = {
  afrobeats: {
    swing: 0.12,
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.35, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0],
    hat: [0.5, 0.25, 0.45, 0.25, 0.5, 0.3, 0.45, 0.25, 0.5, 0.25, 0.45, 0.3, 0.5, 0.25, 0.45, 0.3],
    shaker: [0.3, 0.5, 0.3, 0.5, 0.3, 0.5, 0.3, 0.5, 0.3, 0.5, 0.3, 0.5, 0.3, 0.5, 0.3, 0.5],
    bass: "log",
    keys: "pluck",
    density: 0.9,
  },
  amapiano: {
    swing: 0.16,
    kick: [1, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.3, 0, 0, 0.2, 0, 0, 0, 0, 0.3, 0, 0, 0.2],
    hat: [0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.25],
    shaker: [0.45, 0.2, 0.45, 0.25, 0.45, 0.2, 0.45, 0.25, 0.45, 0.2, 0.45, 0.25, 0.45, 0.2, 0.45, 0.3],
    bass: "log",
    keys: "pad",
    density: 0.85,
  },
  drill: {
    swing: 0,
    kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0.9, 0, 0, 0, 0.7, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
    hat: [0.5, 0.2, 0.35, 0.5, 0.2, 0.45, 0.3, 0.6, 0.5, 0.2, 0.35, 0.5, 0.2, 0.45, 0.3, 0.55],
    shaker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: "808slide",
    keys: "bell",
    density: 0.8,
  },
  trap: {
    swing: 0,
    kick: [1, 0, 0, 0, 0, 0, 0.85, 0, 0, 1, 0, 0, 0, 0.7, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [0.5, 0.3, 0.5, 0.3, 0.55, 0.3, 0.5, 0.35, 0.5, 0.3, 0.5, 0.3, 0.55, 0.3, 0.5, 0.35],
    shaker: [0, 0, 0.2, 0, 0, 0.2, 0, 0, 0, 0.2, 0, 0, 0, 0.2, 0, 0],
    bass: "808",
    keys: "bell",
    density: 0.8,
  },
  hiphop: {
    swing: 0.22,
    kick: [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0.4],
    snare: [0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0],
    hat: [0.45, 0.2, 0.4, 0.2, 0.45, 0.2, 0.4, 0.25, 0.45, 0.2, 0.4, 0.2, 0.45, 0.2, 0.4, 0.3],
    shaker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: "round",
    keys: "rhodes",
    density: 0.75,
  },
  rnb: {
    swing: 0.14,
    kick: [1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.9, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0.2],
    hat: [0.4, 0.15, 0.35, 0.2, 0.4, 0.15, 0.35, 0.2, 0.4, 0.15, 0.35, 0.2, 0.4, 0.15, 0.35, 0.25],
    shaker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: "round",
    keys: "rhodes",
    density: 0.7,
  },
  gospel: {
    swing: 0.1,
    kick: [1, 0, 0, 0, 0.6, 0, 0, 0, 1, 0, 0, 0, 0.6, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.7, 0, 0, 0.25, 0, 0, 0, 0, 0.7, 0, 0, 0.25],
    hat: [0.35, 0.2, 0.3, 0.2, 0.35, 0.2, 0.3, 0.2, 0.35, 0.2, 0.3, 0.2, 0.35, 0.2, 0.3, 0.2],
    shaker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: "round",
    keys: "organ",
    density: 0.8,
  },
  dancehall: {
    swing: 0.08,
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
    hat: [0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2, 0.4, 0.2],
    shaker: [0.25, 0.35, 0.25, 0.35, 0.25, 0.35, 0.25, 0.35, 0.25, 0.35, 0.25, 0.35, 0.25, 0.35, 0.25, 0.35],
    bass: "round",
    keys: "pluck",
    density: 0.8,
  },
  highlife: {
    swing: 0.12,
    kick: [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.5, 0, 0, 0.2, 0, 0, 0, 0, 0.5, 0, 0, 0.2],
    hat: [0.4, 0.25, 0.4, 0.25, 0.4, 0.25, 0.4, 0.25, 0.4, 0.25, 0.4, 0.25, 0.4, 0.25, 0.4, 0.25],
    shaker: [0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4],
    bass: "round",
    keys: "pluck",
    density: 0.85,
  },
  afrofusion: {
    swing: 0.14,
    kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 0.6, 0, 0],
    snare: [0, 0, 0, 0, 0.4, 0, 0, 0.15, 0, 0, 0, 0, 0.4, 0, 0, 0.15],
    hat: [0.45, 0.25, 0.4, 0.3, 0.45, 0.25, 0.4, 0.3, 0.45, 0.25, 0.4, 0.3, 0.45, 0.25, 0.4, 0.3],
    shaker: [0.35, 0.45, 0.35, 0.45, 0.35, 0.45, 0.35, 0.45, 0.35, 0.45, 0.35, 0.45, 0.35, 0.45, 0.35, 0.45],
    bass: "log",
    keys: "pad",
    density: 0.88,
  },
};

export function genreList() {
  return Object.keys(GROOVES);
}

function grooveFor(genre) {
  const key = String(genre || "").toLowerCase().replace(/[^a-z]/g, "");
  return GROOVES[key] ?? GROOVES.afrobeats;
}

/* --------------------------- instruments --------------------------- */

function addVoice(buffer, startSample, render) {
  const from = Math.max(0, Math.floor(startSample));
  if (from >= buffer.length) return;
  const write = (i, value) => {
    const idx = from + i;
    if (idx < buffer.length) buffer[idx] += value;
  };
  render(write, from);
}

function kick(buf, sr, at, gain = 1) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * 0.42);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const freq = 46 + 96 * Math.exp(-t * 26);
      const env = Math.exp(-t * 7.4) * gain;
      write(i, Math.sin(2 * Math.PI * freq * t) * env * 0.95 + (t < 0.004 ? (Math.random() * 2 - 1) * 0.25 : 0));
    }
  });
}

function snare(buf, sr, at, gain = 1) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * 0.26);
    const hp = highpass(1100, sr);
    const lp = lowpass(6200, sr);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const noise = lp(hp(Math.random() * 2 - 1));
      const body = Math.sin(2 * Math.PI * 186 * t) * 0.35;
      write(i, (noise * 0.72 + body) * Math.exp(-t * 20) * gain);
    }
  });
}

function clap(buf, sr, at, gain = 1) {
  addVoice(buf, at * sr, (write) => {
    const hp = highpass(900, sr);
    for (let burst = 0; burst < 3; burst++) {
      const offset = Math.floor(sr * 0.011 * burst);
      const dur = Math.floor(sr * 0.09);
      for (let i = 0; i < dur; i++) {
        const t = i / sr;
        const idx = offset + i;
        write(idx, hp(Math.random() * 2 - 1) * Math.exp(-t * 34) * 0.5 * gain);
      }
    }
  });
}

function hat(buf, sr, at, gain = 1, open = false) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * (open ? 0.28 : 0.055));
    const hp = highpass(7200, sr);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      write(i, hp(Math.random() * 2 - 1) * Math.exp(-t * (open ? 16 : 62)) * 0.34 * gain);
    }
  });
}

function shaker(buf, sr, at, gain = 1) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * 0.1);
    const hp = highpass(4200, sr);
    const lp = lowpass(9800, sr);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      write(i, lp(hp(Math.random() * 2 - 1)) * Math.sin(Math.PI * (i / dur)) * 0.2 * gain);
    }
  });
}

function bassNote(buf, sr, at, freq, durSec, style, gain = 1) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * durSec);
    const lp = lowpass(style === "log" ? 620 : style === "808slide" || style === "808" ? 340 : 480, sr);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const p = i / dur;
      let f = freq;
      if (style === "808slide" || style === "log") f = freq * (1 + 0.55 * Math.exp(-t * 9));
      const phase = 2 * Math.PI * f * t;
      let sample;
      if (style === "log") {
        sample = Math.sin(phase) * 0.9 + Math.sin(phase * 2) * 0.22 + Math.sin(phase * 0.5) * 0.16;
      } else if (style === "808" || style === "808slide") {
        sample = Math.sin(phase) + Math.tanh(Math.sin(phase) * 1.8) * 0.35;
      } else {
        sample = Math.sin(phase) * 0.7 + Math.sin(phase * 2) * 0.2 + Math.sin(phase * 3) * 0.09;
      }
      const attack = Math.min(1, t / 0.012);
      const env = attack * Math.pow(1 - p, style === "log" ? 1.3 : 1.9);
      write(i, lp(sample) * env * 0.62 * gain);
    }
  });
}

function chordTone(buf, sr, at, freqs, durSec, timbre, gain = 0.2, panWrite) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * durSec);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const p = i / dur;
      let sample = 0;
      for (const f of freqs) {
        const phase = 2 * Math.PI * f * t;
        if (timbre === "pluck") sample += Math.sin(phase) * 0.55 + Math.sin(phase * 2) * 0.18 + Math.sin(phase * 3) * 0.07;
        else if (timbre === "pad") sample += Math.sin(phase) * 0.4 + Math.sin(phase * 2.005) * 0.25 + Math.sin(phase * 1.005) * 0.25;
        else if (timbre === "rhodes") sample += Math.sin(phase) * 0.6 + Math.sin(phase * 4) * 0.09 * Math.exp(-t * 3);
        else if (timbre === "organ") sample += Math.sin(phase) * 0.36 + Math.sin(phase * 2) * 0.24 + Math.sin(phase * 4) * 0.1;
        else if (timbre === "bell") sample += Math.sin(phase) * 0.5 + Math.sin(phase * 3.01) * 0.16 * Math.exp(-t * 5);
        else sample += Math.sin(phase) * 0.5;
      }
      sample /= freqs.length;
      const attack = timbre === "pad" || timbre === "organ" ? Math.min(1, t / 0.09) : Math.min(1, t / 0.006);
      const decay = timbre === "pluck" || timbre === "bell" ? Math.exp(-t * 3.1) : Math.pow(1 - p, 1.4);
      const value = sample * attack * decay * gain;
      write(i, value);
      if (panWrite) panWrite(i, value);
    }
  });
}

function melodyNote(buf, sr, at, freq, durSec, gain, delay) {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * durSec);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const phase = 2 * Math.PI * freq * t;
      const sample = Math.sin(phase) * 0.62 + Math.sin(phase * 2) * 0.2 + Math.sin(phase * 3.02) * 0.08;
      const env = Math.min(1, t / 0.008) * Math.exp(-t * 2.6);
      write(i, delay(sample * env * gain));
    }
  });
}

/** Short synthetic producer tag (used on previews only). */
function producerTag(buf, sr, at, text = "2211") {
  addVoice(buf, at * sr, (write) => {
    const dur = Math.floor(sr * 0.9);
    const lp = lowpass(3200, sr);
    for (let i = 0; i < dur; i++) {
      const t = i / sr;
      const sweep = 300 + 900 * Math.exp(-t * 3);
      const tone = Math.sin(2 * Math.PI * sweep * t) * 0.35 + Math.sin(2 * Math.PI * sweep * 1.5 * t) * 0.12;
      const blip = Math.sin(2 * Math.PI * 1400 * t) * 0.1 * Math.exp(-((t - 0.55) ** 2) * 60);
      write(i, lp(tone + blip) * Math.min(1, t / 0.02) * Math.exp(-t * 2.2));
    }
  });
  void text;
}

/* --------------------------- arrangement --------------------------- */

export function renderBeat({
  genre = "afrobeats",
  bpm = 100,
  key = "A minor",
  seed = 1,
  durationSec = 24,
  sampleRate = 22050,
  tag = false,
  stems = false,
  progression = null,
}) {
  const random = makeRandom(seed);
  const groove = grooveFor(genre);
  const { rootMidi, scale } = parseKey(key);
  const totalSamples = Math.floor(sampleRate * durationSec);
  const barSec = (60 / bpm) * 4;
  const stepSec = (60 / bpm) / 4;

  const drumsL = new Float32Array(totalSamples);
  const drumsR = new Float32Array(totalSamples);
  const bassBuf = new Float32Array(totalSamples);
  const keysL = new Float32Array(totalSamples);
  const keysR = new Float32Array(totalSamples);
  const melL = new Float32Array(totalSamples);
  const melR = new Float32Array(totalSamples);

  // Chord progression (scale degrees) — default: i - VI - III - VII
  const degrees = progression ?? [0, 5, 2, 6];
  const chordVoicing = (degree, octaveShift = 0) => {
    const pick = (offset) => {
      const idx = degree + offset;
      const oct = Math.floor(idx / scale.length);
      return rootMidi + scale[((idx % scale.length) + scale.length) % scale.length] + oct * 12 + octaveShift;
    };
    return [pick(0), pick(2), pick(4)];
  };

  const bars = Math.max(1, Math.ceil(durationSec / barSec));
  const delayKeys = makeDelay(sampleRate, stepSec * 3, 0.22, 0.16);
  const delayMel = makeDelay(sampleRate, stepSec * 3, 0.3, 0.26);

  for (let bar = 0; bar < bars; bar++) {
    const barTime = bar * barSec;
    if (barTime > durationSec) break;
    const degree = degrees[bar % degrees.length];
    const chord = chordVoicing(degree, 12);
    const intensity = bar === 0 ? 0.75 : bar % 4 === 3 ? 1 : 0.92;
    const isFill = bar % 4 === 3;

    // drums
    for (let step = 0; step < 16; step++) {
      const swingOffset = step % 2 === 1 ? groove.swing * stepSec * 0.5 : 0;
      const t = barTime + step * stepSec + swingOffset;
      if (t > durationSec) break;
      if (groove.kick[step] && random() < groove.density) {
        kick(drumsL, sampleRate, t, groove.kick[step] * intensity);
        kick(drumsR, sampleRate, t, groove.kick[step] * intensity * 0.92);
      }
      const snareGain = groove.snare[step];
      if (snareGain) {
        if (genre === "gospel" || genre === "dancehall") {
          clap(drumsL, sampleRate, t, snareGain);
          clap(drumsR, sampleRate, t, snareGain);
        } else {
          snare(drumsL, sampleRate, t, snareGain * 0.85);
          snare(drumsR, sampleRate, t, snareGain);
        }
      }
      if (groove.hat[step]) {
        const open = isFill && step >= 12 && step % 2 === 0;
        hat(drumsR, sampleRate, t, groove.hat[step], open);
        hat(drumsL, sampleRate, t, groove.hat[step] * 0.7, open);
      }
      if (groove.shaker[step]) {
        shaker(drumsL, sampleRate, t, groove.shaker[step]);
        shaker(drumsR, sampleRate, t, groove.shaker[step] * 0.8);
      }
      if (isFill && step >= 14 && random() < 0.6) {
        snare(drumsL, sampleRate, t + stepSec * 0.25, 0.4);
        snare(drumsR, sampleRate, t + stepSec * 0.25, 0.5);
      }
    }

    // bass
    const bassRoot = rootMidi - 12 + scale[degree % scale.length] + Math.floor(degree / scale.length) * 12;
    const bassPattern =
      groove.bass === "log"
        ? [0, 0.75, 1.5, 2.25, 3]
        : groove.bass === "808slide" || groove.bass === "808"
          ? [0, 2]
          : [0, 1, 2.5];
    for (const beatOffset of bassPattern) {
      const time = barTime + beatOffset * (60 / bpm);
      if (time > durationSec) break;
      const noteShift = beatOffset === 3 && random() < 0.3 ? 3 : 0;
      bassNote(bassBuf, sampleRate, time, midiToFreq(bassRoot + noteShift), (60 / bpm) * 0.92, groove.bass, intensity);
    }

    // keys
    const chordTime = barTime;
    chordTone(keysL, sampleRate, chordTime, chord.map(midiToFreq), barSec * 0.96, groove.keys, 0.2 * intensity, (i, v) => {
      if (chordTime * sampleRate + i < keysR.length) keysR[Math.floor(chordTime * sampleRate) + i] += v * 0.85;
    });
    if (bar % 2 === 1) {
      chordTone(keysR, sampleRate, chordTime + barSec * 0.5, chordVoicing(degree, 24).map(midiToFreq), barSec * 0.42, groove.keys === "pad" ? "pluck" : groove.keys, 0.12);
    }

    // melody
    if (bar > 0) {
      const notes = 4;
      for (let n = 0; n < notes; n++) {
        if (random() > 0.62) continue;
        const stepIdx = Math.floor(random() * scale.length);
        const midi = rootMidi + 24 + scale[stepIdx] + (degree % 3);
        const t = barTime + n * (60 / bpm) + (random() < 0.3 ? stepSec : 0);
        if (t > durationSec) break;
        melodyNote(melL, sampleRate, t, midiToFreq(midi), (60 / bpm) * 0.8, 0.16 * intensity, (s) => delayMel(s));
        melodyNote(melR, sampleRate, t, midiToFreq(midi) * 1.001, (60 / bpm) * 0.8, 0.13 * intensity, (s) => s);
      }
    }
  }

  // producer tag near the start of previews
  if (tag) {
    producerTag(drumsL, sampleRate, 0.35);
    producerTag(drumsR, sampleRate, 0.35);
  }

  // apply keys delay (stereo width)
  for (let i = 0; i < keysL.length; i++) {
    const d = delayKeys(keysL[i]);
    keysR[i] += d * 0.18;
  }

  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    left[i] = drumsL[i] * 0.9 + bassBuf[i] * 0.95 + keysL[i] + melL[i];
    right[i] = drumsR[i] * 0.9 + bassBuf[i] * 0.95 + keysR[i] + melR[i];
  }

  // soft saturation + fade
  const sat = (x) => Math.tanh(x * 1.06) * 0.92;
  for (let i = 0; i < totalSamples; i++) {
    left[i] = sat(left[i]);
    right[i] = sat(right[i]);
  }
  normalize(left, 0.94);
  normalize(right, 0.94);
  fade(left, sampleRate, 0.02, 0.35);
  fade(right, sampleRate, 0.02, 0.35);

  const mix = encodeWav([left, right], sampleRate);

  if (!stems) return { mix, stems: null, sampleRate, durationSec };

  const stemBufs = {
    drums: [drumsL, drumsR],
    bass: [bassBuf, bassBuf],
    keys: [keysL, keysR],
    melody: [melL, melR],
  };
  const rendered = {};
  for (const [name, chans] of Object.entries(stemBufs)) {
    const l = normalize(Float32Array.from(chans[0]), 0.92);
    const r = normalize(Float32Array.from(chans[1]), 0.92);
    fade(l, sampleRate, 0.02, 0.35);
    fade(r, sampleRate, 0.02, 0.35);
    rendered[name] = encodeWav([l, r], sampleRate);
  }
  return { mix, stems: rendered, sampleRate, durationSec };
}
