/* ============================================================
   script.js — state machine + orchestration
   ============================================================ */

(() => {
  "use strict";

  // ── Color palette — fun, saturated, no two adjacent can match ──
  const PALETTE = [
    "#FF0080", // hot magenta
    "#FFE600", // electric yellow
    "#FF3D00", // red-orange
    "#00FF94", // neon green
    "#7B00FF", // deep violet
    "#00CFFF", // laser blue
    "#FF6A00", // vivid orange
    "#FF00FF", // pure magenta
    "#00FF00", // acid green
    "#0040FF", // cobalt blue
    "#FF1744", // rave red
    "#CCFF00", // yellow-green
  ];

  // Assign a color to each slot so no two adjacent slots share a color.
  // Also wraps: last slice can't match first (circular).
  function assignColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const prev      = i > 0 ? colors[i - 1] : null;
      const wrapFirst = i === count - 1 ? colors[0] : null;
      const forbidden = new Set([prev, wrapFirst]);
      const available = PALETTE.filter(c => !forbidden.has(c));
      colors.push(available[Math.floor(Math.random() * available.length)]);
    }
    return colors;
  }

  // Fisher-Yates shuffle — returns new array
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── State ──
  const STATES = Object.freeze({
    LANDING: "LANDING", RAVING: "RAVING", DECEL: "DECEL",
    REVEAL: "REVEAL",   LOCK_IN: "LOCK_IN", COMPLETE: "COMPLETE",
  });

  const SPIN_SEQUENCE = [
    { kind: "book", slot: 1 }, { kind: "chapter", slot: 1 },
    { kind: "book", slot: 2 }, { kind: "chapter", slot: 2 },
    { kind: "book", slot: 3 }, { kind: "chapter", slot: 3 },
  ];

  const ROW_H = 26; // px — must match CSS .docket-track li height

  const state = {
    phase: STATES.LANDING,
    spinIndex: 0,
    assignments: [null, null, null],
    currentBookForSlot: null,
    // Current shuffled items on the wheel + their colors
    wheelItems: [],   // [{name, chapters?, originalIndex?}, ...]
    wheelColors: [],  // color per slot, same order as wheelItems
  };

  // ── Wheel RAF ──
  let wheelAngle = 0;
  let wheelSpeed = 0;
  let animFrame  = null;

  const BASE_SPEED  = 14;   // deg/frame for 66 items
  const MAX_SPEED   = 60;   // cap so the wheel doesn't become an invisible blur
  const FRICTION    = 0.975;
  const STOP_THRESH = 0.05;

  // Scale spin speed so the same number of items fly past the pointer per frame,
  // regardless of how few slices there are (3 chapters feels as exciting as 66 books).
  function fullSpeedForCount(count) {
    return Math.min(BASE_SPEED * (66 / count), MAX_SPEED);
  }

  // ── Docket (driven by wheel angle, no independent RAF) ──
  let docketTotal = 0;

  // ── DOM ──
  const el = {
    wheel:       document.getElementById("wheel"),
    spinButton:  document.getElementById("spin-button"),
    takeover:    document.getElementById("takeover"),
    docketTrack: document.getElementById("docket-track"),
    studySlots:  () => document.querySelectorAll(".study-slot"),
  };

  // ============================================================
  // Init
  // ============================================================
  function init() {
    setupBookWheel();
    el.spinButton.addEventListener("click", onSpinClicked);
    setPhase(STATES.LANDING);
  }

  // ============================================================
  // Book wheel — shuffled order, synced to docket
  // ============================================================
  function setupBookWheel() {
    // Shuffle books into random order
    const shuffled = shuffle(BIBLE_BOOKS.map((b, i) => ({ ...b, originalIndex: i })));
    const colors   = assignColors(shuffled.length);

    state.wheelItems  = shuffled;
    state.wheelColors = colors;
    state.wheelMode   = "books";
    state.chapterCount = 0;

    renderWheel(shuffled.map(b => b.name), colors, false);
    buildDocket(shuffled, colors);
    syncDocketToWheel();
  }

  // ============================================================
  // Chapter wheel — shuffled chapters, same sync logic
  // ============================================================
  function setupChapterWheel(chapterCount) {
    // Chapters 1..N in shuffled order
    const shuffled = shuffle(
      Array.from({ length: chapterCount }, (_, i) => ({ name: String(i + 1), num: i + 1 }))
    );
    const colors = assignColors(shuffled.length);

    state.wheelItems   = shuffled;
    state.wheelColors  = colors;
    state.wheelMode    = "chapters";
    state.chapterCount = chapterCount;

    renderWheel(shuffled.map(c => c.name), colors, true);
    buildDocket(shuffled, colors);
    syncDocketToWheel();
  }

  // ============================================================
  // Wheel rendering
  // ============================================================
  function renderWheel(labels, colors, isChapter) {
    wheelAngle = 0;
    wheelSpeed = 0;
    el.wheel.style.transform = "rotate(0deg)";
    el.wheel.innerHTML = "";

    const total  = labels.length;
    const segDeg = 360 / total;

    // Conic gradient with full colors — each slice its assigned color
    const stops = labels.map((_, i) => {
      const s = (i * segDeg).toFixed(4);
      const e = ((i + 1) * segDeg).toFixed(4);
      return `${colors[i]} ${s}deg ${e}deg`;
    }).join(", ");
    el.wheel.style.background = `conic-gradient(from -${segDeg / 2}deg, ${stops})`;

    const labelRadius = total <= 24 ? 36 : 42;
    // Slice dividers — skip if only 1 slice (no boundaries to draw)
    for (let i = 0; i < (total > 1 ? total : 0); i++) {
      const div = document.createElement("div");
      div.className = "wheel-divider";
      div.style.transform = `translateX(-50%) rotate(${i * segDeg - segDeg / 2}deg)`;
      el.wheel.appendChild(div);
    }

    labels.forEach((text, i) => {
      const angle = i * segDeg - 90;
      const rad   = angle * Math.PI / 180;
      const label = document.createElement("div");
      label.className   = "wheel-label" + (isChapter ? " chapter-label" : "");
      label.textContent = text;
      label.style.left  = `${50 + labelRadius * Math.cos(rad)}%`;
      label.style.top   = `${50 + labelRadius * Math.sin(rad)}%`;
      const flip = angle > 0 && angle < 180;
      label.style.transform = `translate(-50%, -50%) rotate(${flip ? angle + 180 : angle}deg)`;
      el.wheel.appendChild(label);
    });
  }

  // ============================================================
  // Docket — rebuilt to match whatever is on the wheel
  // ============================================================
  function buildDocket(items, colors) {
    el.docketTrack.innerHTML = "";

    const windowEl     = document.getElementById("docket-window");
    const windowH      = windowEl ? windowEl.clientHeight : window.innerHeight;
    const oneHeight    = items.length * ROW_H;
    const copiesNeeded = Math.ceil(windowH / oneHeight) + 2;

    for (let c = 0; c < copiesNeeded; c++) {
      items.forEach((item, i) => {
        const li = document.createElement("li");
        li.dataset.slotIndex = i;
        li.style.background  = colors[i];
        const chapInfo = item.chapters != null ? `${item.chapters} ch` : "";
        li.innerHTML = `<span>${item.name}</span>${chapInfo ? `<span class="docket-chapters">${chapInfo}</span>` : ""}`;
        el.docketTrack.appendChild(li);
      });
    }

    docketTotal = oneHeight;
    el.docketTrack.style.transform = "translateY(0px)";
  }

  function syncDocketToWheel() {
    const total    = state.wheelItems.length;
    const segDeg   = 360 / total;
    const norm     = ((-wheelAngle % 360) + 360) % 360;
    const fracIdx  = norm / segDeg; // continuous fractional slot index 0..total

    const windowEl = document.getElementById("docket-window");
    const windowH  = windowEl ? windowEl.clientHeight : 600;
    const rawOffset = fracIdx * ROW_H - windowH / 2 + ROW_H / 2;
    const offset    = ((rawOffset % docketTotal) + docketTotal) % docketTotal;
    el.docketTrack.style.transform = `translateY(-${offset}px)`;
  }

  function highlightDocket(slotIndex) {
    el.docketTrack.querySelectorAll("li").forEach(li => li.classList.remove("highlight"));
    if (slotIndex == null) return;
    el.docketTrack.querySelectorAll(`li[data-slot-index="${slotIndex}"]`)
      .forEach(li => li.classList.add("highlight"));

    // Snap docket so the landed item sits exactly at the center pointer
    const windowEl  = document.getElementById("docket-window");
    const windowH   = windowEl ? windowEl.clientHeight : 600;
    const rawOffset = slotIndex * ROW_H - windowH / 2 + ROW_H / 2;
    const offset    = ((rawOffset % docketTotal) + docketTotal) % docketTotal;
    el.docketTrack.style.transform = `translateY(-${offset}px)`;
  }

  // ============================================================
  // Wheel RAF loop
  // ============================================================
  function spinLoop() {
    wheelAngle += wheelSpeed;
    el.wheel.style.transform = `rotate(${wheelAngle}deg)`;
    syncDocketToWheel();

    if (state.phase === STATES.DECEL) {
      wheelSpeed *= FRICTION;
      if (wheelSpeed < STOP_THRESH) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
        onWheelStopped();
        return;
      }
    }

    animFrame = requestAnimationFrame(spinLoop);
  }

  function onWheelStopped() {
    const spinDef   = SPIN_SEQUENCE[state.spinIndex];
    const slotIndex = angleToSlotIndex();
    const item      = state.wheelItems[slotIndex];

    let result;
    if (spinDef.kind === "book") {
      result = { book: item, slotIndex, display: item.name };
      highlightDocket(slotIndex);
    } else {
      result = { chapter: item.num, slotIndex, display: String(item.num), subtitle: state.currentBookForSlot.name };
      highlightDocket(slotIndex);
    }

    reveal(spinDef, result);
  }

  // Converts current wheelAngle to the slot index under the pointer
  function angleToSlotIndex() {
    const total  = state.wheelItems.length;
    const segDeg = 360 / total;
    const norm   = ((-wheelAngle % 360) + 360) % 360;
    return Math.floor((norm + segDeg / 2) / segDeg) % total;
  }

  // ============================================================
  // State machine
  // ============================================================
  function setPhase(next) {
    state.phase = next;
    document.body.dataset.phase = next;
  }

  function onSpinClicked() {
    switch (state.phase) {
      case STATES.LANDING:
      case STATES.LOCK_IN:  startRave();  break;
      case STATES.RAVING:   beginDecel(); break;
      case STATES.COMPLETE: resetAll();   break;
    }
  }

  function startRave() {
    setPhase(STATES.RAVING);
    el.spinButton.textContent = "Stop";
    wheelSpeed = fullSpeedForCount(state.wheelItems.length);
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(spinLoop);
    Disco.startRave(state.wheelItems);
  }

  function beginDecel() {
    setPhase(STATES.DECEL);
    el.spinButton.disabled    = true;
    el.spinButton.textContent = "…";
    wheelAngle += Math.random() * 360;
    Disco.decelerate();
  }

  function reveal(spinDef, result) {
    setPhase(STATES.REVEAL);
    el.spinButton.disabled  = false;
    Particles.detonate();
    if (result.subtitle) {
      el.takeover.innerHTML = `<div class="takeover-subtitle">${result.subtitle}</div><div>${result.display}</div>`;
    } else {
      el.takeover.textContent = result.display;
    }
    el.takeover.classList.remove("hidden");

    setTimeout(() => {
      el.takeover.classList.add("hidden");
      lockIn(spinDef, result);
    }, 2000);
  }

  function lockIn(spinDef, result) {
    setPhase(STATES.LOCK_IN);

    if (spinDef.kind === "book") {
      state.currentBookForSlot = result.book;
      state.spinIndex += 1;
      setupChapterWheel(result.book.chapters);
      el.spinButton.textContent = "Spin";
    } else {
      state.assignments[spinDef.slot - 1] = {
        book: state.currentBookForSlot, chapter: result.chapter,
      };
      state.currentBookForSlot = null;
      updateStudySlot(spinDef.slot);

      state.spinIndex += 1;
      if (state.spinIndex >= SPIN_SEQUENCE.length) {
        finishAll();
        return;
      }
      // Next assignment — fresh shuffle
      setupBookWheel();
      el.spinButton.textContent = "Spin";
    }
  }

  function finishAll() {
    setPhase(STATES.COMPLETE);
    el.spinButton.disabled    = false;
    el.spinButton.textContent = "New Random Bible Study";
    Disco.fadeOut();
  }

  function resetAll() {
    Disco.stopAll();
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    wheelSpeed = 0; wheelAngle = 0;

    state.spinIndex          = 0;
    state.assignments        = [null, null, null];
    state.currentBookForSlot = null;

    el.studySlots().forEach(node => {
      node.classList.remove("filled");
      node.querySelector(".study-book").textContent    = "—";
      node.querySelector(".study-chapter").textContent = "";
    });

    el.spinButton.disabled    = false;
    el.spinButton.textContent = "Spin";
    setupBookWheel();
    setPhase(STATES.LANDING);
  }

  function updateStudySlot(slot) {
    const assign = state.assignments[slot - 1];
    if (!assign) return;
    const node = document.querySelector(`.study-slot[data-slot="${slot}"]`);
    node.classList.add("filled");
    node.querySelector(".study-book").textContent    = assign.book.name;
    node.querySelector(".study-chapter").textContent = `Ch. ${assign.chapter}`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
