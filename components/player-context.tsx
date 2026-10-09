"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Track = {
  id: string;
  slug: string;
  title: string;
  genre: string;
  artist?: string;
  artworkUrl: string;
  src: string | null;
  duration_sec?: number | null;
  bpm?: number | null;
  musical_key?: string | null;
  price_cents?: number;
  currency?: string;
};

type PlayerApi = {
  track: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  levels: number[];
  error: string | null;
  play: (track: Track, queue?: Track[]) => void;
  toggle: (track?: Track) => void;
  pause: () => void;
  seek: (seconds: number) => void;
  seekRatio: (ratio: number) => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  stop: () => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);
const BAR_COUNT = 28;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const countedRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<Track[]>([]);
  const trackRef = useRef<Track | null>(null);

  const [track, setTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.08));
  const [error, setError] = useState<string | null>(null);

  trackRef.current = track;
  queueRef.current = queue;

  /* ------------------------------------------------------------------ */
  /* Visualiser                                                          */
  /* ------------------------------------------------------------------ */

  const stopVisualise = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevels(new Array(BAR_COUNT).fill(0.08));
  }, []);

  const startVisualise = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || rafRef.current) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
      const next: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
        next.push(Math.min(1, sum / step / 200 + 0.05));
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || ctxRef.current) return;
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      /* visualiser is decorative */
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Core playback                                                       */
  /* ------------------------------------------------------------------ */

  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    ensureAnalyser();
    if (ctxRef.current?.state === "suspended") void ctxRef.current.resume();
    audio
      .play()
      .then(() => {
        startVisualise();
        const t = trackRef.current;
        if (t && !countedRef.current.has(t.id)) {
          countedRef.current.add(t.id);
          fetch(`/api/beats/${t.id}/play`, { method: "POST", keepalive: true }).catch(() => {});
        }
      })
      .catch(() => setError("Press play again — your browser blocked autoplay."));
  }, [ensureAnalyser, startVisualise]);

  const load = useCallback(
    (t: Track, nextQueue?: Track[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (!t.src) {
        setError(`"${t.title}" has no preview audio yet.`);
        return;
      }
      setError(null);
      setTrack(t);
      if (nextQueue) setQueue(nextQueue);
      setCurrentTime(0);
      audio.src = t.src;
      audio.volume = muted ? 0 : volume;
      audio.load();
      startPlayback();
    },
    [muted, startPlayback, volume],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    stopVisualise();
  }, [stopVisualise]);

  const play = useCallback((t: Track, q?: Track[]) => load(t, q ?? [t]), [load]);

  const toggle = useCallback(
    (t?: Track) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (t && t.id !== trackRef.current?.id) {
        load(t);
        return;
      }
      if (!trackRef.current) return;
      if (audio.paused) startPlayback();
      else pause();
    },
    [load, pause, startPlayback],
  );

  const step = useCallback(
    (delta: number) => {
      const q = queueRef.current;
      const current = trackRef.current;
      if (!q.length || !current) return;
      const idx = q.findIndex((t) => t.id === current.id);
      const nextIdx = (idx + delta + q.length) % q.length;
      load(q[nextIdx], q);
    },
    [load],
  );

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, max));
    setCurrentTime(audio.currentTime);
  }, []);

  const seekRatio = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration)) return;
      seek(audio.duration * Math.max(0, Math.min(1, ratio)));
    },
    [seek],
  );

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    setMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = clamped === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setMuted(nextMuted);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    stopVisualise();
  }, [stopVisualise]);

  /* ------------------------------------------------------------------ */
  /* Audio element lifecycle                                             */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onErr = () => {
      setError("Audio could not be loaded — the file may still be uploading.");
      setIsPlaying(false);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      const q = queueRef.current;
      const current = trackRef.current;
      if (q.length > 1 && current) {
        const idx = q.findIndex((t) => t.id === current.id);
        const nextTrack = q[(idx + 1) % q.length];
        if (nextTrack?.src) {
          setTrack(nextTrack);
          audio.src = nextTrack.src;
          audio.load();
          audio.play().catch(() => undefined);
        }
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onErr);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onErr);
      audio.removeEventListener("ended", onEnded);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const value = useMemo<PlayerApi>(
    () => ({
      track,
      queue,
      isPlaying,
      currentTime,
      duration: duration || track?.duration_sec || 0,
      volume,
      muted,
      levels,
      error,
      play,
      toggle,
      pause,
      seek,
      seekRatio,
      next: () => step(1),
      prev: () => step(-1),
      setVolume,
      toggleMute,
      stop,
    }),
    [
      currentTime,
      duration,
      error,
      isPlaying,
      levels,
      muted,
      pause,
      play,
      queue,
      seek,
      seekRatio,
      setVolume,
      step,
      stop,
      toggle,
      toggleMute,
      track,
      volume,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
