// ============================================
// ClickClock – Modular Widget Architecture
// ============================================

// ── Audio Context (lazy init) ─────────────────
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

function playBeep(freq = 880, dur = 0.15, vol = 0.3, type = 'sine') {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
    } catch (e) {}
}

function playFinish() {
    [440, 550, 660].forEach((f, i) => {
        setTimeout(() => playBeep(f, 0.3, 0.25), i * 180);
    });
}

function vibrate(ms) {
    if ('vibrate' in navigator) navigator.vibrate(ms);
}

function formatTime(totalSeconds, showHours = true) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (showHours || h > 0) {
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Widget Registry ───────────────────────────
// Add new widgets here – everything else is automatic.
const WIDGETS = [
    { id: 'timer',    icon: '⏱',  label: 'Timer',    factory: createTimerWidget },
    { id: 'stopwatch',icon: '⏲',  label: 'Stopp',    factory: createStopwatchWidget },
    { id: 'counter',  icon: '✚',  label: 'Zähler',   factory: createCounterWidget },
    { id: 'pomodoro', icon: '🍅',  label: 'Pomodoro', factory: createPomodoroWidget },
    { id: 'interval', icon: '🔁',  label: 'Intervall',factory: createIntervalWidget },
    { id: 'world',    icon: '🌍',  label: 'Welt',     factory: createWorldClockWidget },
];

// ── Router ────────────────────────────────────
let activeId = 'timer';
const instances = {};

function navigate(id) {
    if (id === activeId) return;

    const prev = document.querySelector('.widget.active');
    if (prev) {
        prev.classList.add('exit-left');
        prev.classList.remove('active');
        setTimeout(() => prev.classList.remove('exit-left'), 300);
    }

    activeId = id;
    const next = document.getElementById(`widget-${id}`);
    if (next) {
        next.classList.add('active');
        instances[id]?.onShow?.();
    }

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
}

function buildNav() {
    const nav = document.getElementById('bottomNav');
    WIDGETS.forEach(w => {
        const btn = document.createElement('button');
        btn.className = 'nav-item' + (w.id === activeId ? ' active' : '');
        btn.dataset.id = w.id;
        btn.innerHTML = `<span class="nav-icon">${w.icon}</span><span class="nav-label">${w.label}</span>`;
        btn.addEventListener('click', () => navigate(w.id));
        nav.appendChild(btn);
    });
}

function buildWidgets() {
    const stage = document.getElementById('widgetStage');
    WIDGETS.forEach(w => {
        const el = document.createElement('div');
        el.className = 'widget' + (w.id === activeId ? ' active' : '');
        el.id = `widget-${w.id}`;
        stage.appendChild(el);
        instances[w.id] = w.factory(el);
    });
}

// ── Helper: Status Pill ───────────────────────
function statusPill(state) {
    const labels = { running: 'LÄUFT', paused: 'PAUSE', idle: 'BEREIT' };
    return `<span class="status-pill ${state}"><span class="status-dot"></span>${labels[state]}</span>`;
}

// ============================================
// WIDGET: Countdown Timer
// ============================================
function createTimerWidget(el) {
    let seconds = 0, running = false, interval = null;
    let savedH = 0, savedM = 20, savedS = 0;

    el.innerHTML = `
        <div class="card" id="t-input-card">
            <div class="card-label">Countdown einstellen</div>
            <div class="time-inputs-row">
                <div class="time-col">
                    <input class="time-input" id="t-h" type="number" min="0" max="23" placeholder="00" maxlength="2">
                    <div class="time-label">Std</div>
                </div>
                <span class="time-sep">:</span>
                <div class="time-col">
                    <input class="time-input" id="t-m" type="number" min="0" max="59" placeholder="20" maxlength="2">
                    <div class="time-label">Min</div>
                </div>
                <span class="time-sep">:</span>
                <div class="time-col">
                    <input class="time-input" id="t-s" type="number" min="0" max="59" placeholder="00" maxlength="2">
                    <div class="time-label">Sek</div>
                </div>
            </div>
        </div>

        <div class="card hidden" id="t-display-card">
            <div class="between">
                <div class="card-label">Countdown</div>
                <span id="t-status">${statusPill('idle')}</span>
            </div>
            <div class="digit-display" id="t-display">00:00:00</div>
            <div class="progress-track" style="margin-top:8px">
                <div class="progress-fill" id="t-progress" style="width:100%"></div>
            </div>
        </div>

        <div class="btn-row cols-3">
            <button class="btn btn-primary" id="t-start">▶ Start</button>
            <button class="btn btn-ghost" id="t-pause" disabled>⏸ Pause</button>
            <button class="btn btn-ghost" id="t-reset">↺ Reset</button>
        </div>
    `;

    let totalSeconds = 0;

    const inputCard  = el.querySelector('#t-input-card');
    const displayCard= el.querySelector('#t-display-card');
    const display    = el.querySelector('#t-display');
    const progress   = el.querySelector('#t-progress');
    const statusEl   = el.querySelector('#t-status');
    const startBtn   = el.querySelector('#t-start');
    const pauseBtn   = el.querySelector('#t-pause');
    const resetBtn   = el.querySelector('#t-reset');
    const hIn = el.querySelector('#t-h');
    const mIn = el.querySelector('#t-m');
    const sIn = el.querySelector('#t-s');

    // Limit to 2 digits
    [hIn, mIn, sIn].forEach(inp => {
        inp.addEventListener('input', () => {
            if (inp.value.length > 2) inp.value = inp.value.slice(0, 2);
        });
    });

    function updateDisplay() {
        display.textContent = formatTime(seconds);
        const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 100;
        progress.style.width = pct + '%';
        const ratio = seconds / totalSeconds;
        progress.className = 'progress-fill' + (ratio < 0.1 ? ' danger' : ratio < 0.25 ? ' warn' : '');
        display.className   = 'digit-display'  + (ratio < 0.1 ? ' danger' : ratio < 0.25 ? ' warn' : '');
    }

    function start() {
        if (running) return;
        if (!inputCard.classList.contains('hidden')) {
            // Read inputs
            const h = parseInt(hIn.value) || 0;
            const m = parseInt(mIn.value) || 0;
            const s = parseInt(sIn.value) || 0;
            savedH = h; savedM = m; savedS = s;
            seconds = h * 3600 + m * 60 + s;
            totalSeconds = seconds;
            if (seconds <= 0) return;
            inputCard.classList.add('hidden');
            displayCard.classList.remove('hidden');
        }
        running = true;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        statusEl.innerHTML = statusPill('running');
        displayCard.closest('.widget')?.classList.add('running');

        interval = setInterval(() => {
            seconds--;
            updateDisplay();
            if (seconds <= 0) {
                clearInterval(interval);
                running = false;
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                statusEl.innerHTML = statusPill('idle');
                displayCard.closest('.widget')?.classList.remove('running');
                playFinish();
                vibrate([200, 100, 200]);
            }
        }, 1000);
        updateDisplay();
    }

    function pause() {
        if (!running) return;
        clearInterval(interval);
        running = false;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        statusEl.innerHTML = statusPill('paused');
        el.classList.remove('running');
    }

    function reset() {
        clearInterval(interval);
        running = false;
        seconds = 0;
        inputCard.classList.remove('hidden');
        displayCard.classList.add('hidden');
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        hIn.value = savedH || '';
        mIn.value = savedM || '';
        sIn.value = savedS || '';
        el.classList.remove('running');
    }

    startBtn.addEventListener('click', start);
    pauseBtn.addEventListener('click', pause);
    resetBtn.addEventListener('click', reset);

    return { onShow: () => {} };
}

// ============================================
// WIDGET: Stopwatch
// ============================================
function createStopwatchWidget(el) {
    let running = false, interval = null;
    let elapsed = 0; // ms
    let startTime = 0;
    let laps = [];

    el.innerHTML = `
        <div class="card">
            <div class="between">
                <div class="card-label">Stoppuhr</div>
                <span id="sw-status">${statusPill('idle')}</span>
            </div>
            <div class="digit-display" id="sw-display">00:00.0</div>
        </div>

        <div class="btn-row cols-3">
            <button class="btn btn-primary" id="sw-start">▶ Start</button>
            <button class="btn btn-ghost"   id="sw-lap"   disabled>◎ Runde</button>
            <button class="btn btn-ghost"   id="sw-reset">↺ Reset</button>
        </div>

        <div class="card" id="sw-laps-card" style="display:none">
            <div class="card-label">Rundenzeiten</div>
            <div id="sw-laps" style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto"></div>
        </div>
    `;

    const display   = el.querySelector('#sw-display');
    const statusEl  = el.querySelector('#sw-status');
    const startBtn  = el.querySelector('#sw-start');
    const lapBtn    = el.querySelector('#sw-lap');
    const resetBtn  = el.querySelector('#sw-reset');
    const lapsEl    = el.querySelector('#sw-laps');
    const lapsCard  = el.querySelector('#sw-laps-card');

    function formatSw(ms) {
        const total = Math.floor(ms / 100);
        const dec   = total % 10;
        const s     = Math.floor(total / 10) % 60;
        const m     = Math.floor(total / 600) % 60;
        const h     = Math.floor(total / 36000);
        if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${dec}`;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${dec}`;
    }

    function render() { display.textContent = formatSw(elapsed); }

    function toggle() {
        if (running) {
            // Pause
            clearInterval(interval);
            elapsed += Date.now() - startTime;
            running = false;
            startBtn.textContent = '▶ Start';
            lapBtn.disabled = true;
            statusEl.innerHTML = statusPill('paused');
            el.classList.remove('running');
        } else {
            // Start
            startTime = Date.now();
            running = true;
            startBtn.textContent = '⏸ Stopp';
            lapBtn.disabled = false;
            statusEl.innerHTML = statusPill('running');
            el.classList.add('running');
            interval = setInterval(() => {
                const cur = elapsed + Date.now() - startTime;
                display.textContent = formatSw(cur);
            }, 100);
        }
    }

    function lap() {
        const cur = elapsed + Date.now() - startTime;
        laps.push(cur);
        const prev = laps.length > 1 ? laps[laps.length - 2] : 0;
        const diff = cur - prev;
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)';
        div.innerHTML = `<span style="font-family:var(--mono);font-size:.65rem;color:var(--text3)">R${laps.length}</span>
                         <span style="font-family:var(--mono);font-size:.9rem;color:var(--text2)">${formatSw(diff)}</span>
                         <span style="font-family:var(--mono);font-size:.9rem;color:var(--accent)">${formatSw(cur)}</span>`;
        lapsEl.prepend(div);
        lapsCard.style.display = 'block';
        vibrate(50);
    }

    function reset() {
        clearInterval(interval);
        running = false; elapsed = 0; laps = [];
        display.textContent = '00:00.0';
        startBtn.textContent = '▶ Start';
        lapBtn.disabled = true;
        statusEl.innerHTML = statusPill('idle');
        lapsEl.innerHTML = '';
        lapsCard.style.display = 'none';
        el.classList.remove('running');
    }

    startBtn.addEventListener('click', toggle);
    lapBtn.addEventListener('click', lap);
    resetBtn.addEventListener('click', reset);

    return { onShow: () => {} };
}

// ============================================
// WIDGET: Counter
// ============================================
function createCounterWidget(el) {
    let count = 0;

    el.innerHTML = `
        <div class="card btn-tap-area" id="c-tap" style="flex:1;min-height:160px">
            <div class="counter-big" id="c-display">0</div>
            <div class="tap-label">tippen zum zählen</div>
        </div>

        <div class="card">
            <div class="card-label">Schnelladd</div>
            <div class="add-btn-grid">
                ${[2,3,4,5,6].map(n => `<button class="btn btn-ghost" data-add="${n}">+${n}</button>`).join('')}
            </div>
        </div>

        <div class="btn-row cols-2">
            <button class="btn btn-danger" id="c-undo">← Undo</button>
            <button class="btn btn-ghost"  id="c-reset">↺ Reset</button>
        </div>
    `;

    const display = el.querySelector('#c-display');
    let lastCount = 0;

    function update() { display.textContent = count; }

    el.querySelector('#c-tap').addEventListener('click', () => {
        lastCount = count;
        count++;
        update();
        vibrate(30);
        playBeep(660, 0.06, 0.1);
    });

    el.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            lastCount = count;
            count += parseInt(btn.dataset.add);
            update();
            vibrate(40);
        });
    });

    el.querySelector('#c-undo').addEventListener('click', () => {
        count = lastCount;
        update();
        vibrate(60);
    });

    el.querySelector('#c-reset').addEventListener('click', () => {
        lastCount = count;
        count = 0;
        update();
    });

    return { onShow: () => {} };
}

// ============================================
// WIDGET: Pomodoro
// ============================================
function createPomodoroWidget(el) {
    const WORK  = 25 * 60;
    const SHORT = 5  * 60;
    const LONG  = 15 * 60;

    let phase = 'work'; // work | short | long
    let sessionsDone = 0;
    let seconds = WORK;
    let running = false, interval = null;
    const SESSIONS_PER_CYCLE = 4;

    function getTotal() {
        return phase === 'work' ? WORK : phase === 'short' ? SHORT : LONG;
    }

    function renderDots() {
        return Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) =>
            `<div class="session-dot ${i < sessionsDone % SESSIONS_PER_CYCLE ? 'done' : ''}"></div>`
        ).join('');
    }

    el.innerHTML = `
        <div class="card">
            <div class="pomodoro-phase" id="pm-phase">ARBEITSPHASE</div>
            <div class="digit-display accent" id="pm-display">25:00</div>
            <div class="progress-track" style="margin-top:8px">
                <div class="progress-fill" id="pm-progress" style="width:100%"></div>
            </div>
        </div>

        <div class="card">
            <div class="card-label">Sitzungen</div>
            <div class="pomodoro-sessions" id="pm-dots">${renderDots()}</div>
            <div style="text-align:center;margin-top:8px;font-family:var(--mono);font-size:.7rem;color:var(--text3)">
                Gesamt: <span id="pm-total">0</span> Pomodori
            </div>
        </div>

        <div class="btn-row cols-3">
            <button class="btn btn-primary" id="pm-start">▶ Start</button>
            <button class="btn btn-ghost"   id="pm-skip">⏭ Überspr.</button>
            <button class="btn btn-ghost"   id="pm-reset">↺ Reset</button>
        </div>

        <div class="card">
            <div class="card-label">Zeiten (Minuten)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:4px">
                <div class="interval-field">
                    <label>Arbeit</label>
                    <input id="pm-cfg-work"  type="number" min="1" max="90" value="25">
                </div>
                <div class="interval-field">
                    <label>Kurze Pause</label>
                    <input id="pm-cfg-short" type="number" min="1" max="30" value="5">
                </div>
                <div class="interval-field">
                    <label>Lange Pause</label>
                    <input id="pm-cfg-long"  type="number" min="1" max="60" value="15">
                </div>
            </div>
        </div>
    `;

    const display  = el.querySelector('#pm-display');
    const phaseEl  = el.querySelector('#pm-phase');
    const progressEl=el.querySelector('#pm-progress');
    const dotsEl   = el.querySelector('#pm-dots');
    const totalEl  = el.querySelector('#pm-total');
    const startBtn = el.querySelector('#pm-start');
    const skipBtn  = el.querySelector('#pm-skip');
    const resetBtn = el.querySelector('#pm-reset');
    const cfgWork  = el.querySelector('#pm-cfg-work');
    const cfgShort = el.querySelector('#pm-cfg-short');
    const cfgLong  = el.querySelector('#pm-cfg-long');

    function getConfig() {
        return {
            work:  (parseInt(cfgWork.value)  || 25) * 60,
            short: (parseInt(cfgShort.value) || 5)  * 60,
            long:  (parseInt(cfgLong.value)  || 15) * 60,
        };
    }

    function updateDisplay() {
        const total = getConfig()[phase === 'work' ? 'work' : phase === 'short' ? 'short' : 'long'];
        display.textContent = formatTime(seconds, false);
        const pct = total > 0 ? (seconds / total) * 100 : 0;
        progressEl.style.width = pct + '%';
        display.className = 'digit-display ' + (phase === 'work' ? 'accent' : 'success');
        progressEl.className = 'progress-fill' + (phase !== 'work' ? ' success' : '');
    }

    function setPhase(p) {
        phase = p;
        const cfg = getConfig();
        seconds = p === 'work' ? cfg.work : p === 'short' ? cfg.short : cfg.long;
        const labels = { work: 'ARBEITSPHASE', short: 'KURZE PAUSE', long: 'LANGE PAUSE' };
        phaseEl.textContent = labels[p];
        updateDisplay();
        dotsEl.innerHTML = renderDots();
    }

    function advancePhase() {
        if (phase === 'work') {
            sessionsDone++;
            totalEl.textContent = sessionsDone;
            dotsEl.innerHTML = renderDots();
            playFinish();
            vibrate([300, 100, 300]);
            if (sessionsDone % SESSIONS_PER_CYCLE === 0) setPhase('long');
            else setPhase('short');
        } else {
            setPhase('work');
            playBeep(660, 0.2, 0.2);
            vibrate(200);
        }
    }

    function tick() {
        seconds--;
        updateDisplay();
        if (seconds <= 0) {
            clearInterval(interval);
            running = false;
            startBtn.textContent = '▶ Start';
            advancePhase();
            // Auto-start next
            setTimeout(start, 1000);
        }
    }

    function start() {
        if (running) {
            clearInterval(interval);
            running = false;
            startBtn.textContent = '▶ Start';
            el.classList.remove('running');
        } else {
            running = true;
            startBtn.textContent = '⏸ Pause';
            el.classList.add('running');
            interval = setInterval(tick, 1000);
        }
    }

    function skip() {
        clearInterval(interval);
        running = false;
        startBtn.textContent = '▶ Start';
        el.classList.remove('running');
        advancePhase();
    }

    function reset() {
        clearInterval(interval);
        running = false;
        sessionsDone = 0;
        startBtn.textContent = '▶ Start';
        el.classList.remove('running');
        totalEl.textContent = '0';
        setPhase('work');
    }

    startBtn.addEventListener('click', start);
    skipBtn.addEventListener('click', skip);
    resetBtn.addEventListener('click', reset);

    [cfgWork, cfgShort, cfgLong].forEach(inp => {
        inp.addEventListener('change', () => { if (!running) setPhase(phase); });
    });

    updateDisplay();
    return { onShow: () => {} };
}

// ============================================
// WIDGET: Interval Timer
// ============================================
function createIntervalWidget(el) {
    let running = false, interval = null;
    let seconds = 0, round = 1;
    let phase = 'work'; // work | rest
    let totalRounds = 0, workSec = 0, restSec = 0;

    el.innerHTML = `
        <div class="card" id="iv-config-card">
            <div class="card-label">Konfiguration</div>
            <div class="interval-config">
                <div class="interval-field">
                    <label>Arbeitszeit (Sek)</label>
                    <input id="iv-work" type="number" min="1" value="30">
                </div>
                <div class="interval-field">
                    <label>Pause (Sek)</label>
                    <input id="iv-rest" type="number" min="0" value="10">
                </div>
                <div class="interval-field">
                    <label>Runden</label>
                    <input id="iv-rounds" type="number" min="1" value="8">
                </div>
                <div class="interval-field">
                    <label>Vorlauf (Sek)</label>
                    <input id="iv-prep" type="number" min="0" value="5">
                </div>
            </div>
        </div>

        <div class="card hidden" id="iv-display-card">
            <div class="interval-round-label" id="iv-phase-label">VORBEREITUNG</div>
            <div class="digit-display accent" id="iv-display">00:30</div>
            <div class="progress-track" style="margin-top:8px">
                <div class="progress-fill" id="iv-progress" style="width:100%"></div>
            </div>
            <div style="text-align:center;margin-top:10px;font-family:var(--mono);font-size:.75rem;color:var(--text3)">
                Runde <span id="iv-round-display">1</span> / <span id="iv-total-display">8</span>
            </div>
        </div>

        <div class="btn-row cols-3">
            <button class="btn btn-primary" id="iv-start">▶ Start</button>
            <button class="btn btn-ghost"   id="iv-pause" disabled>⏸ Pause</button>
            <button class="btn btn-ghost"   id="iv-reset">↺ Reset</button>
        </div>
    `;

    const cfgCard   = el.querySelector('#iv-config-card');
    const dispCard  = el.querySelector('#iv-display-card');
    const display   = el.querySelector('#iv-display');
    const phaseLabel= el.querySelector('#iv-phase-label');
    const progressEl= el.querySelector('#iv-progress');
    const roundDisp = el.querySelector('#iv-round-display');
    const totalDisp = el.querySelector('#iv-total-display');
    const startBtn  = el.querySelector('#iv-start');
    const pauseBtn  = el.querySelector('#iv-pause');
    const resetBtn  = el.querySelector('#iv-reset');
    const workInp   = el.querySelector('#iv-work');
    const restInp   = el.querySelector('#iv-rest');
    const roundsInp = el.querySelector('#iv-rounds');
    const prepInp   = el.querySelector('#iv-prep');

    function updateDisplay(total) {
        display.textContent = formatTime(seconds, false);
        const pct = total > 0 ? (seconds / total) * 100 : 0;
        progressEl.style.width = pct + '%';
        const isRest = phase === 'rest';
        display.className = 'digit-display ' + (phase === 'prep' ? '' : isRest ? 'warn' : 'accent');
        progressEl.className = 'progress-fill' + (isRest ? ' warn' : '');
    }

    function tick() {
        seconds--;
        const total = phase === 'work' ? workSec : phase === 'rest' ? restSec : 5;
        updateDisplay(total);

        if (seconds <= 0) {
            playBeep(phase === 'work' ? 440 : 880, 0.2, 0.25);
            vibrate(150);

            if (phase === 'prep') {
                phase = 'work';
                seconds = workSec;
                phaseLabel.textContent = 'ARBEIT';
                updateDisplay(workSec);
            } else if (phase === 'work') {
                if (round >= totalRounds) {
                    // Done
                    clearInterval(interval);
                    running = false;
                    startBtn.disabled = false;
                    pauseBtn.disabled = true;
                    playFinish();
                    vibrate([200, 100, 200, 100, 200]);
                    phaseLabel.textContent = '✓ FERTIG';
                    el.classList.remove('running');
                    return;
                }
                phase = 'rest';
                seconds = restSec;
                phaseLabel.textContent = 'PAUSE';
                updateDisplay(restSec);
            } else if (phase === 'rest') {
                round++;
                roundDisp.textContent = round;
                phase = 'work';
                seconds = workSec;
                phaseLabel.textContent = 'ARBEIT';
                updateDisplay(workSec);
            }
        }
    }

    function start() {
        if (running) return;
        if (!dispCard.classList.contains('hidden')) {
            // Resume
        } else {
            workSec     = parseInt(workInp.value)   || 30;
            restSec     = parseInt(restInp.value)   || 10;
            totalRounds = parseInt(roundsInp.value) || 8;
            const prep  = parseInt(prepInp.value)   || 0;
            round = 1;
            totalDisp.textContent = totalRounds;
            roundDisp.textContent = 1;
            if (prep > 0) {
                phase = 'prep'; seconds = prep;
                phaseLabel.textContent = 'VORBEREITUNG';
            } else {
                phase = 'work'; seconds = workSec;
                phaseLabel.textContent = 'ARBEIT';
            }
            cfgCard.classList.add('hidden');
            dispCard.classList.remove('hidden');
            updateDisplay(seconds);
        }
        running = true;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        el.classList.add('running');
        interval = setInterval(tick, 1000);
    }

    function pause() {
        clearInterval(interval);
        running = false;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        el.classList.remove('running');
    }

    function reset() {
        clearInterval(interval);
        running = false;
        cfgCard.classList.remove('hidden');
        dispCard.classList.add('hidden');
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        el.classList.remove('running');
    }

    startBtn.addEventListener('click', start);
    pauseBtn.addEventListener('click', pause);
    resetBtn.addEventListener('click', reset);

    return { onShow: () => {} };
}

// ============================================
// WIDGET: World Clock
// ============================================
function createWorldClockWidget(el) {
    const ZONES = [
        { city: 'New York',     zone: 'America/New_York',   flag: '🇺🇸' },
        { city: 'London',       zone: 'Europe/London',      flag: '🇬🇧' },
        { city: 'Berlin',       zone: 'Europe/Berlin',      flag: '🇩🇪' },
        { city: 'Dubai',        zone: 'Asia/Dubai',         flag: '🇦🇪' },
        { city: 'Singapur',     zone: 'Asia/Singapore',     flag: '🇸🇬' },
        { city: 'Tokio',        zone: 'Asia/Tokyo',         flag: '🇯🇵' },
        { city: 'Sydney',       zone: 'Australia/Sydney',   flag: '🇦🇺' },
        { city: 'Los Angeles',  zone: 'America/Los_Angeles',flag: '🇺🇸' },
    ];

    el.innerHTML = `
        <div class="card">
            <div class="card-label">Weltzeituhr</div>
            <div class="tz-list" id="wc-list"></div>
        </div>
    `;

    const list = el.querySelector('#wc-list');

    // Create items
    ZONES.forEach(z => {
        const item = document.createElement('div');
        item.className = 'tz-item';
        item.dataset.zone = z.zone;
        item.innerHTML = `
            <div class="tz-left">
                <div class="tz-city">${z.flag} ${z.city}</div>
                <div class="tz-zone">${z.zone.replace('/', ' / ')}</div>
            </div>
            <div>
                <div class="tz-time" data-time></div>
                <div class="tz-date" data-date></div>
            </div>
        `;
        list.appendChild(item);
    });

    let ticker = null;

    function update() {
        const now = new Date();
        list.querySelectorAll('.tz-item').forEach(item => {
            const zone = item.dataset.zone;
            const timeStr = now.toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = now.toLocaleDateString('de-DE', { timeZone: zone, weekday: 'short', day: '2-digit', month: '2-digit' });
            item.querySelector('[data-time]').textContent = timeStr;
            item.querySelector('[data-date]').textContent = dateStr;
        });
    }

    update();

    return {
        onShow: () => {
            update();
            ticker = setInterval(update, 1000);
        },
        onHide: () => clearInterval(ticker),
    };
}

// ── Boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    buildNav();
    buildWidgets();
});
