/* Simple i18n registry */
const i18n = {
  es: {
    titleStopwatch: "Cronómetro",
    titleCountdown: "Cuenta atrás",
    modeStopwatch: "Modo: Cronómetro",
    modeCountdown: "Modo: Cuenta atrás",
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    lap: "Lap",
    laps: "Parciales",
    clear: "Limpiar",
    set: "Fijar",
  },
  // Example: extend here to support 'en', etc.
};

const KEY = "stopwatch:v1";

// Utils
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const pad = (n, len = 2) => n.toString().padStart(len, "0");
function formatTime(ms) {
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / 3600000);
  ms -= hours * 3600000;
  const minutes = Math.floor(ms / 60000);
  ms -= minutes * 60000;
  const seconds = Math.floor(ms / 1000);
  const millis = ms - seconds * 1000;
  const base = `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
  return hours > 0 ? `${pad(hours, 2)}:${base}` : base;
}

/** Time engine independent of UI */
class TimeEngine {
  constructor({ mode = "stopwatch", targetMs = 0 } = {}) {
    this.mode = mode; // 'stopwatch' | 'countdown'
    this.targetMs = targetMs; // for countdown
    this.running = false;
    this.t0 = 0; // last start time (epoch ms)
    this.acc = 0; // accumulated elapsed before current run
    this.laps = [];
  }

  _now() { return Date.now(); }

  _elapsed() {
    const run = this.running ? (this._now() - this.t0) : 0;
    return this.acc + run;
  }

  /** visible time in ms (stopwatch: elapsed; countdown: remaining) */
  nowMs() {
    if (this.mode === "stopwatch") return this._elapsed();
    const remaining = this.targetMs - this._elapsed();
    return remaining <= 0 ? 0 : remaining;
  }

  start() {
    if (this.running) return;
    this.t0 = this._now();
    this.running = true;
    this._persist();
  }

  pause() {
    if (!this.running) return;
    this.acc += (this._now() - this.t0);
    this.running = false;
    this._persist();
  }

  resume() {
    if (this.running) return;
    // If countdown reached 0, do nothing
    if (this.mode === "countdown" && this.nowMs() <= 0) return;
    this.t0 = this._now();
    this.running = true;
    this._persist();
  }

  reset() {
    this.running = false;
    this.t0 = 0;
    this.acc = 0;
    this.laps = [];
    this._persist();
  }

  setCountdownTarget(ms) {
    this.targetMs = Math.max(0, ms|0);
    // keep elapsed as-is; visible time derives from target - elapsed
    this._persist();
  }

  lap() {
    const absoluteMs = this.nowMsAbsolute();
    const lastAbs = this.laps.length ? this.laps[this.laps.length - 1].absoluteMs : 0;
    const deltaMs = absoluteMs - lastAbs;
    const rec = {
      index: this.laps.length + 1,
      absoluteMs,
      deltaMs,
      timestampISO: new Date().toISOString(),
    };
    this.laps.push(rec);
    this._persist();
    return rec;
  }

  /** absolute rising time for laps (stopwatch: elapsed; countdown: elapsed from 0) */
  nowMsAbsolute() {
    return this._elapsed();
  }

  getState() {
    return {
      mode: this.mode,
      running: this.running,
      t0: this.t0,
      accumulated: this.acc,
      targetMs: this.targetMs,
      laps: [...this.laps],
      lastPersistedAt: this._lastPersistedAt,
    };
  }

  toJSON() {
    return JSON.stringify(this.getState());
  }

  fromJSON(json) {
    try {
      const s = JSON.parse(json);
      this.mode = s.mode || "stopwatch";
      this.running = !!s.running;
      this.t0 = s.t0 || 0;
      this.acc = s.accumulated || 0;
      this.targetMs = s.targetMs || 0;
      this.laps = Array.isArray(s.laps) ? s.laps : [];
      // Recalculate accumulated if running to cover time away
      if (this.running && this.t0) {
        this.acc += (Date.now() - this.t0);
        this.t0 = Date.now();
      }
      this._lastPersistedAt = s.lastPersistedAt || 0;
    } catch {
      // noop
    }
  }

  _persist() {
    const payload = this.getState();
    payload.lastPersistedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(payload));
    this._lastPersistedAt = payload.lastPersistedAt;
  }
}

/** Presentation + wiring */
(function () {
  const lang = "es";
  const t = (k) => (i18n[lang] && i18n[lang][k]) || k;

  // Elements
  const displayEl = document.getElementById("timeDisplay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const resetBtn = document.getElementById("resetBtn");
  const lapBtn = document.getElementById("lapBtn");
  const clearLapsBtn = document.getElementById("clearLapsBtn");
  const lapsList = document.getElementById("lapsList");
  const appTitle = document.getElementById("app-title");
  const modeLabel = document.getElementById("modeLabel");
  const modeToggle = document.getElementById("modeToggle");
  const countdownConfig = document.getElementById("countdownConfig");
  const cdH = document.getElementById("cdHours");
  const cdM = document.getElementById("cdMinutes");
  const cdS = document.getElementById("cdSeconds");
  const cdMs = document.getElementById("cdMillis");
  const countdownForm = document.getElementById("countdownForm");

  // Labels
  startBtn.textContent = t("start");
  pauseBtn.textContent = t("pause");
  resumeBtn.textContent = t("resume");
  resetBtn.textContent = t("reset");
  lapBtn.textContent = t("lap");
  clearLapsBtn.textContent = t("clear");

  // Engine
  const engine = new TimeEngine();

  // Restore state
  const saved = localStorage.getItem(KEY);
  if (saved) {
    engine.fromJSON(saved);
  }
  applyMode(engine.mode);
  renderLaps(engine.laps);

  // Apply countdown target from fields
  countdownForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const ms =
      clamp(parseInt(cdH.value || 0), 0, 99) * 3600000 +
      clamp(parseInt(cdM.value || 0), 0, 59) * 60000 +
      clamp(parseInt(cdS.value || 0), 0, 59) * 1000 +
      clamp(parseInt(cdMs.value || 0), 0, 999);
    engine.setCountdownTarget(ms);
    display(forceFormat(engine.nowMs()));
  });

  function applyMode(mode) {
    engine.mode = mode;
    const isCountdown = mode === "countdown";
    appTitle.textContent = isCountdown ? t("titleCountdown") : t("titleStopwatch");
    modeLabel.textContent = isCountdown ? t("modeCountdown") : t("modeStopwatch");
    countdownConfig.hidden = !isCountdown;
    // If switching to countdown without target, use current inputs
    if (isCountdown && engine.targetMs === 0) {
      const evt = new Event("submit"); countdownForm.dispatchEvent(evt);
    }
    engine._persist();
  }

  modeToggle.checked = engine.mode === "countdown";
  modeToggle.addEventListener("change", () => {
    applyMode(modeToggle.checked ? "countdown" : "stopwatch");
  });

  // Controls
  startBtn.addEventListener("click", () => {
    engine.start();
    syncButtons();
  });
  pauseBtn.addEventListener("click", () => {
    engine.pause();
    syncButtons();
  });
  resumeBtn.addEventListener("click", () => {
    engine.resume();
    syncButtons();
  });
  resetBtn.addEventListener("click", () => {
    engine.reset();
    renderLaps([]);
    syncButtons(true);
    display(forceFormat(engine.nowMs()));
  });
  lapBtn.addEventListener("click", () => {
    const rec = engine.lap();
    renderLaps(engine.laps, rec);
  });
  clearLapsBtn.addEventListener("click", () => {
    engine.laps = [];
    engine._persist();
    renderLaps([]);
  });

  // Keyboard shortcuts
  const shortcuts = {
    toggle: " ",
    reset: "r",
    lap: "l",
  };
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === shortcuts.toggle.trim().toLowerCase()) {
      e.preventDefault();
      if (!engine.running && engine._elapsed() === 0) engine.start();
      else if (engine.running) engine.pause();
      else engine.resume();
      syncButtons();
    } else if (key === shortcuts.reset) {
      e.preventDefault();
      engine.reset(); renderLaps([]); syncButtons(true); display(forceFormat(engine.nowMs()));
    } else if (key === shortcuts.lap) {
      e.preventDefault();
      const rec = engine.lap(); renderLaps(engine.laps, rec);
    }
  });

  // Laps rendering
  function renderLaps(list, highlight) {
    lapsList.innerHTML = "";
    list.forEach((lap) => {
      const li = document.createElement("li");
      li.className = "laps-item";
      const idx = document.createElement("span");
      idx.textContent = pad(lap.index, 2);
      const abs = document.createElement("time");
      abs.textContent = formatTime(lap.absoluteMs);
      const delta = document.createElement("span");
      delta.className = "delta";
      delta.textContent = "+" + formatTime(lap.deltaMs);
      const del = document.createElement("button");
      del.className = "btn small";
      del.textContent = "×";
      del.setAttribute("aria-label", "Borrar parcial");
      del.addEventListener("click", () => {
        engine.laps = engine.laps.filter((x) => x !== lap).map((x, i) => ({ ...x, index: i + 1 }));
        engine._persist();
        renderLaps(engine.laps);
      });
      li.append(idx, abs, delta, del);
      lapsList.appendChild(li);
    });
    if (highlight) {
      lapsList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Display
  let lastString = "";
  function forceFormat(ms) { return formatTime(ms); }
  function display(str) {
    if (str !== lastString) {
      lastString = str;
      displayEl.textContent = str;
    }
  }

  function syncButtons(justReset = false) {
    const running = engine.running;
    startBtn.disabled = running || engine._elapsed() > 0;
    pauseBtn.disabled = !running;
    resumeBtn.disabled = running || (engine.mode === "countdown" && engine.nowMs() <= 0);
    // Lap always enabled; on countdown at 0 should be disabled
    lapBtn.disabled = engine.mode === "countdown" && engine.nowMs() <= 0;
    if (justReset) startBtn.disabled = false;
  }
  syncButtons();

  // Render loop (only when visible digits change)
  function tick() {
    const ms = engine.nowMs();
    // Auto-stop countdown at zero
    if (engine.mode === "countdown" && engine.running && ms <= 0) {
      engine.pause();
      syncButtons();
    }
    const s = forceFormat(ms);
    display(s);
    requestAnimationFrame(tick);
  }
  // initialize display
  display(forceFormat(engine.nowMs()));
  tick();

  // Expose public API
  window.stopwatch = {
    start: () => engine.start(),
    pause: () => engine.pause(),
    resume: () => engine.resume(),
    reset: () => { engine.reset(); renderLaps([]); syncButtons(true); display(forceFormat(engine.nowMs())); },
    lap: () => engine.lap(),
    getState: () => engine.getState(),
  };
})();
