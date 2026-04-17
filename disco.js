/* ============================================================
   disco.js — nightclub atmosphere engine
   ------------------------------------------------------------
   Public API:
     Disco.startRave(items)  — dark room, spinning spotlights
     Disco.decelerate()      — slow spotlights, fade out
     Disco.stopAll()         — immediate cleanup
   ============================================================ */

const Disco = (() => {
  "use strict";

  const SPOT_COLORS = [
    "#FF0080", "#7B00FF", "#00CFFF", "#FF6A00",
    "#00FF94", "#FF00FF", "#0040FF", "#CCFF00",
  ];

  // ── State ──
  let rafId     = null;
  let phase     = "idle"; // "raving" | "decel" | "idle"
  let fadeAlpha = 1;
  let ambientTs = 0; // timestamp for slow color wash

  // Spotlights
  const spots = [];

  // ── DOM helpers ──
  const $ = id => document.getElementById(id);

  function getEls() {
    return {
      bg:      $("rave-bg"),
      spotsEl: $("spotlights"),
    };
  }

  function getWheelCenter() {
    const wheel = document.getElementById("wheel");
    if (!wheel) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = wheel.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ============================================================
  // Public API
  // ============================================================

  function startRave(items) {
    const alreadyActive = phase !== "idle";
    phase     = "raving";
    fadeAlpha = 1;

    const e = getEls();
    e.bg.classList.remove("hidden");
    e.spotsEl.classList.remove("hidden");
    e.bg.style.opacity      = "1";
    e.spotsEl.style.opacity = "1";

    if (!alreadyActive) {
      ambientHue = 240;
      ambientTs  = 0;
      initSpotlights(e.spotsEl);
      Music.start();
      document.body.classList.add("rave-active");
    }

    if (!rafId) {
      rafId = requestAnimationFrame(ts => loop(ts, e));
    }
  }

  function decelerate() {
    // Spotlights keep spinning at full speed — music is still playing
    phase = "decel";
  }

  function stopAll() {
    phase = "idle";
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    cleanup();
  }

  // ============================================================
  // RAF loop
  // ============================================================

  function loop(ts, e) {
    if (phase === "idle") return;

    tickAmbient(ts, e.bg);
    tickSpotlights();

    if (phase === "fadeout") {
      fadeAlpha = Math.max(0, fadeAlpha - 0.005);
      e.bg.style.opacity      = fadeAlpha;
      e.spotsEl.style.opacity = fadeAlpha;
      if (fadeAlpha === 0) { stopAll(); return; }
    }

    rafId = requestAnimationFrame(ts2 => loop(ts2, e));
  }

  // ============================================================
  // Slow ambient color wash — no flashing, just a breathing hue shift
  // ============================================================

  let ambientHue = 240; // start deep blue
  function tickAmbient(ts, bgEl) {
    // Drift hue ~30°/second (very slow, imperceptible per-frame)
    const delta = ts - ambientTs;
    ambientTs = ts;
    ambientHue = (ambientHue + delta * 0.012) % 360;
    bgEl.style.background =
      `radial-gradient(ellipse at center, hsl(${ambientHue},70%,12%) 0%, rgba(0,0,0,0.92) 70%)`;
  }

  // ============================================================
  // Spotlights — rotate from wheel center
  // ============================================================

  function initSpotlights(container) {
    container.innerHTML = "";
    spots.length = 0;

    const c  = getWheelCenter();
    const cx = (c.x / window.innerWidth)  * 100;
    const cy = (c.y / window.innerHeight) * 100;

    for (let i = 0; i < 48; i++) {
      const beam  = document.createElement("div");
      const color = SPOT_COLORS[i % SPOT_COLORS.length];
      const angle = (i / 48) * 360;
      const speed = (Math.random() < 0.7
        ? 0.15 + Math.random() * 0.2    // slow (70%)
        : 1.5  + Math.random() * 1.0    // fast (30%)
      ) * (Math.random() < 0.5 ? 1 : -1);
      const width = 2 + Math.random() * 3; // px

      Object.assign(beam.style, {
        position:        "absolute",
        top:             `${cy}%`,
        left:            `${cx}%`,
        width:           `${width}px`,
        height:          "140vmax",
        background:      `linear-gradient(to bottom, ${color}cc 0%, ${color}55 25%, ${color}11 60%, transparent 100%)`,
        transformOrigin: "top center",
        transform:       `rotate(${angle}deg)`,
        mixBlendMode:    "screen",
        pointerEvents:   "none",
        borderRadius:    "0 0 50% 50%",
      });

      container.appendChild(beam);
      spots.push({ el: beam, angle, speed, color });
    }
  }

  function tickSpotlights() {
    spots.forEach(s => {
      s.angle += s.speed;
      s.el.style.transform = `rotate(${s.angle}deg)`;
    });
  }


  // ============================================================
  // Cleanup
  // ============================================================

  function cleanup() {
    const e = getEls();
    e.bg.classList.add("hidden");
    e.spotsEl.classList.add("hidden");
    e.bg.style.opacity      = "1";
    e.spotsEl.style.opacity = "1";
    e.spotsEl.innerHTML = "";
    spots.length = 0;
    Music.stop();
    document.body.classList.remove("rave-active");
  }

  function fadeOut() {
    phase = "fadeout";
  }

  return { startRave, decelerate, stopAll, fadeOut };
})();
