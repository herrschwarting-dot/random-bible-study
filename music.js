/* ============================================================
   music.js — playlist with crossfade loop
   ------------------------------------------------------------
   Public API:
     Music.start()  — begin playback from first track
     Music.stop()   — fade out and halt
   ============================================================ */

const Music = (() => {
  "use strict";

  const PLAYLIST = [
    "music/Mordecai's Vindication.wav",
  ];

  const FADE_S    = 3;    // crossfade duration in seconds
  const PRELOAD_S = 10;   // start preloading next track this many seconds before crossfade

  let trackIdx   = 0;
  let player     = null;  // currently playing Audio
  let nextPlayer = null;  // preloaded and ready to go
  let stopped    = true;
  let xfadeTimer   = null;
  let preloadTimer = null;

  // Pre-buffer the first track immediately so first Spin has no delay
  const primed = new Audio(PLAYLIST[0]);
  primed.preload = "auto";
  primed.load();

  function fadeTo(audio, targetVol, durationMs, onComplete) {
    const startVol  = audio.volume;
    const startTime = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - startTime) / durationMs);
      audio.volume = startVol + (targetVol - startVol) * t;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        audio.volume = targetVol;
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(tick);
  }

  function clearTimers() {
    if (xfadeTimer)   { clearTimeout(xfadeTimer);   xfadeTimer   = null; }
    if (preloadTimer) { clearTimeout(preloadTimer);  preloadTimer = null; }
  }

  function scheduleTimers(incoming) {
    const duration = incoming.duration;
    if (!duration || isNaN(duration)) return;

    const xfadeDelay   = Math.max(0, (duration - FADE_S)            * 1000);
    const preloadDelay = Math.max(0, (duration - FADE_S - PRELOAD_S) * 1000);

    // Preload the next track well before crossfade
    preloadTimer = setTimeout(() => {
      const nextIdx  = (trackIdx + 1) % PLAYLIST.length;
      nextPlayer = new Audio(PLAYLIST[nextIdx]);
      nextPlayer.preload = "auto";
      nextPlayer.volume  = 0;
      nextPlayer.load();
    }, preloadDelay);

    // Crossfade when FADE_S from end
    xfadeTimer = setTimeout(() => {
      if (player === incoming && !stopped) crossfadeToNext();
    }, xfadeDelay);
  }

  function crossfadeToNext() {
    if (stopped) return;
    trackIdx = (trackIdx + 1) % PLAYLIST.length;

    const incoming = nextPlayer || new Audio(PLAYLIST[trackIdx]);
    nextPlayer = null;
    incoming.volume = 0;
    incoming.play().catch(() => {});
    fadeTo(incoming, 1, FADE_S * 1000);

    // Fade out old player
    const outgoing = player;
    fadeTo(outgoing, 0, FADE_S * 1000, () => {
      outgoing.pause();
      outgoing.src = "";
    });

    player = incoming;

    // Schedule next cycle once duration is known
    if (incoming.readyState >= 1 && incoming.duration) {
      scheduleTimers(incoming);
    } else {
      incoming.addEventListener("loadedmetadata", () => scheduleTimers(incoming), { once: true });
    }

    // Safety net
    incoming.addEventListener("ended", () => {
      if (player === incoming && !stopped) crossfadeToNext();
    }, { once: true });
  }

  function start() {
    if (!stopped) return;
    stopped  = false;
    trackIdx = 0;

    player = primed; // already buffered, plays instantly
    player.volume = 1;
    player.play().catch(() => {});

    if (player.readyState >= 1 && player.duration) {
      scheduleTimers(player);
    } else {
      player.addEventListener("loadedmetadata", () => scheduleTimers(player), { once: true });
    }

    player.addEventListener("ended", () => {
      if (player && !stopped) crossfadeToNext();
    }, { once: true });
  }

  function stop() {
    stopped = true;
    clearTimers();
    if (nextPlayer) { nextPlayer.src = ""; nextPlayer = null; }
    if (player) {
      const outgoing = player;
      player = null;
      fadeTo(outgoing, 0, 1500, () => {
        outgoing.pause();
        outgoing.src = "";
      });
    }
  }

  return { start, stop };
})();
