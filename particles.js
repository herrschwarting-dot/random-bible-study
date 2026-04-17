/* ============================================================
   particles.js — confetti detonation system
   ------------------------------------------------------------
   Thin wrapper around canvas-confetti (loaded via CDN in
   index.html, exposed as window.confetti).

   Call Particles.detonate() at the REVEAL moment — the name
   flashes white, then this erupts from spinner center outward.

   STATUS: scaffolding stub. CDN is wired; detonate() defined
   with sensible defaults but not yet triggered by script.js.
   ============================================================ */

const Particles = (() => {
  "use strict";

  const PARTY_COLORS = [
    "#FF006E", // hot pink
    "#FFBE0B", // golden yellow
    "#FB5607", // orange
    "#8338EC", // purple
    "#3A86FF", // electric blue
    "#06FFA5", // mint green
    "#FF4D6D", // coral
    "#C9184A", // raspberry
    "#FFFFFF", // white sparkles
  ];

  /**
   * Detonate confetti from the spinner epicenter.
   * @param {{x:number, y:number}} [origin] — normalized 0..1 coords; defaults to center
   */
  function detonate(origin = { x: 0.5, y: 0.5 }) {
    if (typeof window.confetti !== "function") {
      console.warn("[particles] canvas-confetti not loaded");
      return;
    }

    // Main radial burst — HIGH velocity, 360° spread
    window.confetti({
      particleCount: 220,
      spread: 360,
      startVelocity: 55,
      ticks: 240,
      gravity: 0.9,
      scalar: 1.1,
      origin,
      colors: PARTY_COLORS,
    });

    // Streamers — longer-lived, wider spread
    window.confetti({
      particleCount: 60,
      spread: 180,
      startVelocity: 70,
      ticks: 320,
      scalar: 1.6,
      shapes: ["square"],
      origin,
      colors: PARTY_COLORS,
    });

    // Sparkle flash — quick short-lived burst
    window.confetti({
      particleCount: 80,
      spread: 360,
      startVelocity: 35,
      ticks: 90,
      scalar: 0.7,
      origin,
      colors: ["#FFFFFF", "#FFBE0B"],
    });
  }

  /** TODO: ongoing ambient glitter during rave */
  function startAmbient() { /* TBD */ }
  function stopAmbient()  { /* TBD */ }

  return { detonate, startAmbient, stopAmbient };
})();
