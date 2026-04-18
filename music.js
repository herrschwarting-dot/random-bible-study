/* ============================================================
   music.js — random-shuffle playlist loop
   ------------------------------------------------------------
   Public API:
     Music.start()
     Music.stop()
     Music.onChange(cb)       — cb({ current, upcoming: [t1, t2, t3] })
     Music.getCurrent()       — pretty name of current track, or null
     Music.getUpcoming()      — array of next 3 pretty names (may repeat if playlist is short)
   ============================================================ */

const Music = (() => {
  "use strict";

  const PLAYLIST = [
    "music/Into The BibleVerse.wav",
    "music/Lord's Presence.wav",
    "music/Mordecai's Vindication.wav",
  ];

  let trackIdx = -1;
  let queue    = [];  // upcoming indices, pre-rolled so onChange can report them
  let player   = null;
  let stopped  = true;

  const subs = new Set();

  // Strip "music/" prefix + extension for display
  function prettyName(path) {
    if (!path) return null;
    const file = path.split("/").pop();
    return file.replace(/\.[^.]+$/, "");
  }

  function getCurrent()  { return trackIdx >= 0 ? prettyName(PLAYLIST[trackIdx]) : null; }
  function getUpcoming() { return queue.slice(0, 3).map(i => prettyName(PLAYLIST[i])); }

  function notify() {
    const payload = { current: getCurrent(), upcoming: getUpcoming() };
    subs.forEach(cb => { try { cb(payload); } catch (e) {} });
  }

  function onChange(cb) {
    if (typeof cb !== "function") return;
    subs.add(cb);
    cb({ current: getCurrent(), upcoming: getUpcoming() });
  }

  // Pick an index that isn't `avoid` (when possible)
  function pickNext(avoid) {
    if (PLAYLIST.length <= 1) return 0;
    let n = Math.floor(Math.random() * PLAYLIST.length);
    if (n === avoid) n = (n + 1) % PLAYLIST.length;
    return n;
  }

  // Refill queue so we always know the next few tracks ahead of time.
  function refillQueue() {
    const lookahead = 3;
    let last = trackIdx;
    while (queue.length < lookahead) {
      const n = pickNext(last);
      queue.push(n);
      last = n;
    }
  }

  function playTrack(idx) {
    if (stopped) return;

    if (player) { player.pause(); player.src = ""; player = null; }

    trackIdx = idx;
    refillQueue();

    player = new Audio(PLAYLIST[idx]);
    player.volume = 1;
    player.play().catch(() => {});

    // Fire change notification when playback actually begins
    player.addEventListener("playing", () => { notify(); }, { once: true });
    player.addEventListener("ended", () => {
      if (stopped) return;
      const next = queue.shift();
      playTrack(next != null ? next : pickNext(trackIdx));
    }, { once: true });
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    const firstIdx = Math.floor(Math.random() * PLAYLIST.length);
    queue = [];
    playTrack(firstIdx);
  }

  function stop() {
    stopped = true;
    if (player) { player.pause(); player.src = ""; player = null; }
    trackIdx = -1;
    // Clear then refill so Now Playing reads "—" but the on-deck slots
    // still show what's waiting for the next session.
    queue = [];
    refillQueue();
    notify();
  }

  // Pre-fill the upcoming queue at load so the dock can show what's "on deck"
  // before the rave starts. trackIdx stays -1 until actual playback begins,
  // so Now Playing still reads "—" until rave kicks in.
  refillQueue();

  // Warm the audio cache at page load. Each track gets fetched + decoded into
  // the browser's HTTP cache now, so the first real Music.start() doesn't
  // stall the main thread decoding a fresh .wav.
  PLAYLIST.forEach(src => {
    const warm = new Audio();
    warm.preload = "auto";
    warm.src = src;
  });

  document.addEventListener("visibilitychange", () => {
    if (stopped || document.hidden) return;
    if (player) player.play().catch(() => {});
  });

  // Force a specific track by substring match against PLAYLIST paths.
  // Used to hard-pick "Into The BibleVerse" for the finale track.
  function play(match) {
    const idx = PLAYLIST.findIndex(p => p.includes(match));
    if (idx < 0) return;
    stopped = false;
    playTrack(idx);
  }

  return { start, stop, play, onChange, getCurrent, getUpcoming };
})();
