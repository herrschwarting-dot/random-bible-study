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
    "music/Mordecai's Vindication.wav",
    "music/David's Ten-Stringed Instrument.wav",
    "music/Esther's Boldness.wav",
  ];

  // Reserved finale track — not in the shuffle pool. Plays once via
  // Music.play("Into The BibleVerse") after the last spin, then the music
  // stops so the Bible study can take focus.
  const FINALE_TRACK = "music/Into The BibleVerse.wav";

  let trackIdx = -1;
  let queue    = [];  // upcoming indices, pre-rolled so onChange can report them
  let player   = null;
  let stopped  = true;
  let isFinale = false;

  // Fisher-Yates in-place shuffle
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Build a fresh shuffled bag of all playlist indices. Ensures the first
  // item isn't `avoid` so we don't get a back-to-back repeat across bags.
  function makeBag(avoid) {
    const bag = shuffle(PLAYLIST.map((_, i) => i));
    if (bag.length > 1 && bag[0] === avoid) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    return bag;
  }

  const subs = new Set();

  // Strip "music/" prefix + extension for display
  function prettyName(path) {
    if (!path) return null;
    const file = path.split("/").pop();
    return file.replace(/\.[^.]+$/, "");
  }

  let finaleName = null;
  function getCurrent()  {
    if (isFinale) return finaleName;
    return trackIdx >= 0 ? prettyName(PLAYLIST[trackIdx]) : null;
  }
  function getUpcoming() {
    // During the finale there are no "on deck" tracks — music ends after it.
    if (isFinale) return ["—", "—", "—"];
    return queue.slice(0, 3).map(i => prettyName(PLAYLIST[i]));
  }

  function notify() {
    const payload = { current: getCurrent(), upcoming: getUpcoming() };
    subs.forEach(cb => { try { cb(payload); } catch (e) {} });
  }

  function onChange(cb) {
    if (typeof cb !== "function") return;
    subs.add(cb);
    cb({ current: getCurrent(), upcoming: getUpcoming() });
  }

  // True shuffle: every track plays exactly once before any repeats.
  // The queue is continuously topped up with fresh shuffled bags so the
  // upcoming-3 lookahead always has content even on a tiny playlist.
  function refillQueue() {
    const lookahead = 3;
    while (queue.length < lookahead) {
      const last = queue.length ? queue[queue.length - 1] : trackIdx;
      const bag  = makeBag(last);
      queue.push(...bag);
    }
  }

  function playTrack(idx) {
    if (stopped) return;

    if (player) { player.pause(); player.src = ""; player = null; }

    isFinale = false;
    trackIdx = idx;
    refillQueue();

    player = new Audio(PLAYLIST[idx]);
    player.volume = 1;
    player.play().catch(() => {});

    // Fire change notification when playback actually begins
    player.addEventListener("playing", () => { notify(); }, { once: true });
    player.addEventListener("ended", () => {
      if (stopped) return;
      // refillQueue keeps the queue non-empty, so shift is always safe.
      refillQueue();
      playTrack(queue.shift());
    }, { once: true });
  }

  // Finale playback: play the reserved track once, then stop everything so
  // the Bible study can have silence. Not part of the shuffle pool.
  function playFinale() {
    if (player) { player.pause(); player.src = ""; player = null; }

    stopped    = false;
    isFinale   = true;
    trackIdx   = -1;
    queue      = [];
    finaleName = prettyName(FINALE_TRACK);

    player = new Audio(FINALE_TRACK);
    player.volume = 1;
    player.play().catch(() => {});

    player.addEventListener("playing", () => { notify(); }, { once: true });
    player.addEventListener("ended", () => {
      // Music is done for the session — stop cleanly.
      stop();
    }, { once: true });
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    // Honor the pre-rolled queue so the "on deck" track the user sees is
    // exactly what actually plays. Previously this re-rolled a random
    // first track and threw away the pre-filled queue, causing a visible
    // mismatch between the dock and reality.
    refillQueue();
    playTrack(queue.shift());
  }

  function stop() {
    stopped = true;
    if (player) { player.pause(); player.src = ""; player = null; }
    trackIdx = -1;
    isFinale = false;
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
  [...PLAYLIST, FINALE_TRACK].forEach(src => {
    const warm = new Audio();
    warm.preload = "auto";
    warm.src = src;
  });

  document.addEventListener("visibilitychange", () => {
    if (stopped || document.hidden) return;
    if (player) player.play().catch(() => {});
  });

  // Force a specific track by substring match. The finale track lives
  // outside PLAYLIST — if the caller asks for it, route through playFinale
  // so the music ends cleanly when it finishes.
  function play(match) {
    if (FINALE_TRACK.includes(match)) {
      playFinale();
      return;
    }
    const idx = PLAYLIST.findIndex(p => p.includes(match));
    if (idx < 0) return;
    stopped = false;
    playTrack(idx);
  }

  return { start, stop, play, onChange, getCurrent, getUpcoming };
})();
