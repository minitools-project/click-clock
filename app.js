// ============================================
// ClickClock – Widget Architecture
// ============================================

// ── Audio ─────────────────────────────────────
let _ctx = null;
function ac() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
}
function beep(freq = 880, dur = 0.15, vol = 0.22) {
    try {
        const c = ac(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = freq; o.type = 'sine';
        g.gain.setValueAtTime(vol, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        o.start(c.currentTime); o.stop(c.currentTime + dur);
    } catch(e) {}
}
function beepFinish() { [440,554,659].forEach((f,i) => setTimeout(() => beep(f,0.28,0.18), i*160)); }
function vib(ms) { if ('vibrate' in navigator) navigator.vibrate(ms); }

// ── Formatting ────────────────────────────────
function pad(n) { return String(n).padStart(2,'0'); }
function fmt(s, forceH = false) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
    return (forceH || h > 0) ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
function fmtMs(ms) {
    const d = Math.floor(ms/100)%10, s = Math.floor(ms/1000)%60,
          m = Math.floor(ms/60000)%60, h = Math.floor(ms/3600000);
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}.${d}` : `${pad(m)}:${pad(s)}.${d}`;
}

// ── Status badge ──────────────────────────────
function mkBadge(state) {
    const L = {idle:'Bereit', running:'Läuft', paused:'Pause', done:'Fertig'};
    return `<span class="badge ${state}"><span class="badge-dot"></span>${L[state]||state}</span>`;
}

// ============================================
// Widget Registry – add new widgets here
// ============================================
const WIDGETS = [
    { id:'combo',     icon:'⏱', label:'Timer',     factory: wCombo },
    { id:'stopwatch', icon:'⏲', label:'Stopp',     factory: wStopwatch },
    { id:'counter',   icon:'✚', label:'Zähler',    factory: wCounter },
    { id:'pomodoro',  icon:'🍅', label:'Pomodoro',  factory: wPomodoro },
    { id:'interval',  icon:'🔁', label:'Intervall', factory: wInterval },
    { id:'world',     icon:'🌍', label:'Welt',      factory: wWorldClock },
];

// ── Router ────────────────────────────────────
let active = 'combo';
const inst = {};

function go(id) {
    if (id === active) return;
    inst[active]?.onHide?.();
    const prev = document.querySelector('.widget.active');
    if (prev) { prev.classList.add('exit-left'); prev.classList.remove('active'); }
    setTimeout(() => prev?.classList.remove('exit-left'), 260);
    active = id;
    document.getElementById(`w-${id}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    inst[id]?.onShow?.();
}

function boot() {
    const stage = document.getElementById('widgetStage');
    const nav   = document.getElementById('bottomNav');
    WIDGETS.forEach(w => {
        const el = document.createElement('div');
        el.className = 'widget' + (w.id === active ? ' active' : '');
        el.id = `w-${w.id}`;
        stage.appendChild(el);
        inst[w.id] = w.factory(el);

        const btn = document.createElement('button');
        btn.className = 'nav-item' + (w.id === active ? ' active' : '');
        btn.dataset.id = w.id;
        btn.innerHTML = `<span class="nav-icon">${w.icon}</span><span class="nav-label">${w.label}</span>`;
        btn.addEventListener('click', () => go(w.id));
        nav.appendChild(btn);
    });
}

// ============================================
// WIDGET: Timer + Counter (Kombination – Original)
// Timer oben, Tap-Counter unten, beide gleichzeitig sichtbar
// ============================================
function wCombo(el) {
    // ── Timer state ──
    let tSec=0, tTotal=0, tRunning=false, tIv=null, savedH=0, savedM=0, savedS=0;
    // ── Counter state ──
    let count=0, prevCount=0;

    el.style.cssText = 'display:flex;flex-direction:column;gap:0;padding:0;overflow:hidden;';

    el.innerHTML = `
      <!-- TIMER HALF -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <!-- Input view -->
        <div id="co-in" style="flex:1;display:flex;align-items:center;justify-content:center;">
          <div class="timer-inputs-container">
            <div class="time-col">
              <input class="timer-input" id="co-h" type="number" min="0" max="23" placeholder="00">
              <span class="input-label">Std</span>
            </div>
            <span class="timer-separator">:</span>
            <div class="time-col">
              <input class="timer-input" id="co-m" type="number" min="0" max="59" placeholder="00">
              <span class="input-label">Min</span>
            </div>
            <span class="timer-separator">:</span>
            <div class="time-col">
              <input class="timer-input" id="co-s" type="number" min="0" max="59" placeholder="00">
              <span class="input-label">Sek</span>
            </div>
          </div>
        </div>
        <!-- Running view -->
        <div id="co-run" class="hidden" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 12px;">
          <div class="timer-display" id="co-disp" style="padding:10px 12px;">00:00:00</div>
          <div class="progress-track" style="width:100%;"><div class="progress-fill" id="co-prog" style="width:100%"></div></div>
        </div>
        <!-- Timer buttons -->
        <div class="btn-row c3" style="border-top:1px solid var(--white-12);flex-shrink:0;">
          <button class="btn" id="co-start">▶ Start</button>
          <button class="btn" id="co-pause" disabled>⏸ Pause</button>
          <button class="btn" id="co-reset">↺ Reset</button>
        </div>
      </div>

      <!-- DIVIDER -->
      <div style="height:1px;background:var(--white-12);flex-shrink:0;"></div>

      <!-- COUNTER HALF -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <!-- Tap area -->
        <div class="tap-area" id="co-tap" style="flex:1;">
          <div class="counter-num" id="co-num">0</div>
          <div class="tap-hint">TAP</div>
        </div>
        <!-- +2…+6 row -->
        <div class="btn-row c5" style="height:48px;border-top:1px solid var(--white-12);">
          <button class="btn" style="font-size:.85rem;" data-add="2">+2</button>
          <button class="btn" style="font-size:.85rem;" data-add="3">+3</button>
          <button class="btn" style="font-size:.85rem;" data-add="4">+4</button>
          <button class="btn" style="font-size:.85rem;" data-add="5">+5</button>
          <button class="btn" style="font-size:.85rem;" data-add="6">+6</button>
        </div>
        <!-- Undo / Reset -->
        <div class="btn-row c2" style="border-top:1px solid var(--white-12);">
          <button class="btn" id="co-undo">← Undo</button>
          <button class="btn" id="co-creset">↺ Reset</button>
        </div>
      </div>
    `;

    // ── Timer refs ──
    const inCard  = el.querySelector('#co-in');
    const runCard = el.querySelector('#co-run');
    const disp    = el.querySelector('#co-disp');
    const prog    = el.querySelector('#co-prog');
    const startB  = el.querySelector('#co-start');
    const pauseB  = el.querySelector('#co-pause');
    const hIn=el.querySelector('#co-h'), mIn=el.querySelector('#co-m'), sIn=el.querySelector('#co-s');
    [hIn,mIn,sIn].forEach(i => i.addEventListener('input', () => { if(i.value.length>2) i.value=i.value.slice(0,2); }));

    function tDraw() {
        disp.textContent = fmt(tSec, true);
        const r = tTotal>0 ? tSec/tTotal : 1;
        prog.style.width = (r*100)+'%';
        const cls = r<0.1?' danger':r<0.25?' warn':'';
        prog.className='progress-fill'+cls; disp.className='timer-display'+cls;
        disp.style.padding='10px 12px';
    }

    function tStart() {
        if (tRunning) return;
        if (!inCard.classList.contains('hidden')) {
            const h=parseInt(hIn.value)||0, m=parseInt(mIn.value)||0, s=parseInt(sIn.value)||0;
            savedH=h; savedM=m; savedS=s; tSec=tTotal=h*3600+m*60+s;
            if (tSec<=0) return;
            inCard.classList.add('hidden'); runCard.classList.remove('hidden');
        }
        tRunning=true; startB.disabled=true; pauseB.disabled=false;
        tIv = setInterval(() => {
            tSec--; tDraw();
            if (tSec<=0) { clearInterval(tIv); tRunning=false; startB.disabled=false; pauseB.disabled=true; beepFinish(); vib([200,80,200]); }
        }, 1000);
        tDraw();
    }

    function tPause() {
        if (!tRunning) return; clearInterval(tIv); tRunning=false;
        startB.disabled=false; pauseB.disabled=true;
    }

    function tReset() {
        clearInterval(tIv); tRunning=false; tSec=0;
        inCard.classList.remove('hidden'); runCard.classList.add('hidden');
        startB.disabled=false; pauseB.disabled=true;
        hIn.value=savedH||''; mIn.value=savedM||''; sIn.value=savedS||'';
    }

    startB.addEventListener('click', tStart);
    pauseB.addEventListener('click', tPause);
    el.querySelector('#co-reset').addEventListener('click', tReset);

    // ── Counter refs ──
    const numEl = el.querySelector('#co-num');
    function cDraw() { numEl.textContent = count; }

    el.querySelector('#co-tap').addEventListener('click', () => { prevCount=count; count++; cDraw(); vib(25); beep(660,0.06,0.08); });
    el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); prevCount=count; count+=+b.dataset.add; cDraw(); vib(35); }));
    el.querySelector('#co-undo').addEventListener('click',  () => { count=prevCount; cDraw(); vib(50); });
    el.querySelector('#co-creset').addEventListener('click', () => { prevCount=count; count=0; cDraw(); });

    return {};
}

// ============================================
// WIDGET: Countdown Timer (standalone)
// ============================================
function wTimer(el) {
    let sec=0, total=0, running=false, iv=null, savedH=0, savedM=20, savedS=0;

    el.innerHTML = `
      <div class="card" id="ti-in">
        <div class="timer-inputs-container">
          <div class="time-col">
            <input class="timer-input" id="ti-h" type="number" min="0" max="23" placeholder="00">
            <span class="input-label">Std</span>
          </div>
          <span class="timer-separator">:</span>
          <div class="time-col">
            <input class="timer-input" id="ti-m" type="number" min="0" max="59" placeholder="00">
            <span class="input-label">Min</span>
          </div>
          <span class="timer-separator">:</span>
          <div class="time-col">
            <input class="timer-input" id="ti-s" type="number" min="0" max="59" placeholder="00">
            <span class="input-label">Sek</span>
          </div>
        </div>
      </div>

      <div class="card hidden" id="ti-run">
        <div class="status-row">
          <span class="label" style="padding:0">Countdown</span>
          <span id="ti-bdg">${mkBadge('idle')}</span>
        </div>
        <div class="timer-display" id="ti-disp">00:00:00</div>
        <div class="progress-track"><div class="progress-fill" id="ti-prog" style="width:100%"></div></div>
      </div>

      <div class="card btn-row c3">
        <button class="btn" id="ti-start">▶ Start</button>
        <button class="btn" id="ti-pause" disabled>⏸ Pause</button>
        <button class="btn" id="ti-reset">↺ Reset</button>
      </div>`;

    const inCard = el.querySelector('#ti-in'), runCard = el.querySelector('#ti-run');
    const disp=el.querySelector('#ti-disp'), prog=el.querySelector('#ti-prog'), bdg=el.querySelector('#ti-bdg');
    const startB=el.querySelector('#ti-start'), pauseB=el.querySelector('#ti-pause');
    const hIn=el.querySelector('#ti-h'), mIn=el.querySelector('#ti-m'), sIn=el.querySelector('#ti-s');
    [hIn,mIn,sIn].forEach(i => i.addEventListener('input', () => { if(i.value.length>2) i.value=i.value.slice(0,2); }));

    function draw() {
        disp.textContent = fmt(sec, true);
        const r = total>0 ? sec/total : 1;
        prog.style.width = (r*100)+'%';
        const cls = r<0.1?' danger':r<0.25?' warn':'';
        prog.className = 'progress-fill'+cls; disp.className = 'timer-display'+cls;
    }
    function start() {
        if (running) return;
        if (!inCard.classList.contains('hidden')) {
            const h=parseInt(hIn.value)||0, m=parseInt(mIn.value)||0, s=parseInt(sIn.value)||0;
            savedH=h; savedM=m; savedS=s; sec=total=h*3600+m*60+s;
            if (sec<=0) return;
            inCard.classList.add('hidden'); runCard.classList.remove('hidden');
        }
        running=true; startB.disabled=true; pauseB.disabled=false; bdg.innerHTML=mkBadge('running');
        iv = setInterval(() => { sec--; draw(); if(sec<=0){clearInterval(iv);running=false;startB.disabled=false;pauseB.disabled=true;bdg.innerHTML=mkBadge('done');beepFinish();vib([200,80,200]);} }, 1000);
        draw();
    }
    function pause() {
        if(!running) return; clearInterval(iv); running=false;
        startB.disabled=false; pauseB.disabled=true; bdg.innerHTML=mkBadge('paused');
    }
    function reset() {
        clearInterval(iv); running=false; sec=0;
        inCard.classList.remove('hidden'); runCard.classList.add('hidden');
        startB.disabled=false; pauseB.disabled=true;
        hIn.value=savedH||''; mIn.value=savedM||''; sIn.value=savedS||'';
    }
    startB.addEventListener('click', start);
    pauseB.addEventListener('click', pause);
    el.querySelector('#ti-reset').addEventListener('click', reset);
    return {};
}

// ============================================
// WIDGET: Stopwatch
// ============================================
function wStopwatch(el) {
    let running=false, iv=null, elapsed=0, t0=0, laps=[];

    el.innerHTML = `
      <div class="card">
        <div class="status-row">
          <span class="label" style="padding:0">Stoppuhr</span>
          <span id="sw-bdg">${mkBadge('idle')}</span>
        </div>
        <div class="timer-display" id="sw-disp">00:00.0</div>
      </div>
      <div class="card btn-row c3">
        <button class="btn" id="sw-tog">▶ Start</button>
        <button class="btn" id="sw-lap" disabled>◎ Runde</button>
        <button class="btn" id="sw-reset">↺ Reset</button>
      </div>
      <div class="card hidden" id="sw-laps-card">
        <span class="label">Rundenzeiten</span>
        <div class="laps-list" id="sw-laps"></div>
      </div>`;

    const disp=el.querySelector('#sw-disp'), bdg=el.querySelector('#sw-bdg');
    const togB=el.querySelector('#sw-tog'), lapB=el.querySelector('#sw-lap');
    const lapsEl=el.querySelector('#sw-laps'), lapsCard=el.querySelector('#sw-laps-card');
    function cur() { return elapsed+(running?Date.now()-t0:0); }

    function toggle() {
        if (running) {
            elapsed+=Date.now()-t0; clearInterval(iv); running=false;
            togB.textContent='▶ Start'; lapB.disabled=true; bdg.innerHTML=mkBadge('paused');
        } else {
            t0=Date.now(); running=true;
            togB.textContent='⏸ Stopp'; lapB.disabled=false; bdg.innerHTML=mkBadge('running');
            iv = setInterval(() => disp.textContent=fmtMs(cur()), 100);
        }
    }
    function lap() {
        const c=cur(), prev=laps.length?laps[laps.length-1]:0, diff=c-prev;
        laps.push(c);
        const row=document.createElement('div'); row.className='lap-row';
        row.innerHTML=`<span class="lap-n">R${laps.length}</span><span class="lap-split">${fmtMs(diff)}</span><span class="lap-tot">${fmtMs(c)}</span>`;
        lapsEl.prepend(row); lapsCard.classList.remove('hidden'); vib(40);
    }
    function reset() {
        clearInterval(iv); running=false; elapsed=0; laps=[];
        disp.textContent='00:00.0'; togB.textContent='▶ Start'; lapB.disabled=true;
        bdg.innerHTML=mkBadge('idle'); lapsEl.innerHTML=''; lapsCard.classList.add('hidden');
    }
    togB.addEventListener('click', toggle);
    lapB.addEventListener('click', lap);
    el.querySelector('#sw-reset').addEventListener('click', reset);
    return {};
}

// ============================================
// WIDGET: Counter
// ============================================
function wCounter(el) {
    let count=0, prev=0;
    el.innerHTML = `
      <div class="card tap-area" id="c-tap">
        <div class="counter-num" id="c-num">0</div>
        <div class="tap-hint">Tippen zum Zählen</div>
      </div>
      <div class="card btn-row c5 h48">
        ${[2,3,4,5,6].map(n=>`<button class="btn" data-add="${n}">+${n}</button>`).join('')}
      </div>
      <div class="card btn-row c2">
        <button class="btn" id="c-undo">← Undo</button>
        <button class="btn" id="c-reset">↺ Reset</button>
      </div>`;
    const num=el.querySelector('#c-num');
    function draw() { num.textContent=count; }
    el.querySelector('#c-tap').addEventListener('click', () => { prev=count; count++; draw(); vib(25); beep(660,0.06,0.08); });
    el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { prev=count; count+=+b.dataset.add; draw(); vib(35); }));
    el.querySelector('#c-undo').addEventListener('click',  () => { count=prev; draw(); vib(50); });
    el.querySelector('#c-reset').addEventListener('click', () => { prev=count; count=0; draw(); });
    return {};
}

// ============================================
// WIDGET: Pomodoro
// ============================================
function wPomodoro(el) {
    const CYCLE=4;
    let phase='work', sessions=0, sec=0, running=false, iv=null;
    function cfg() { return { work:(parseInt(el.querySelector('#pm-cw').value)||25)*60, short:(parseInt(el.querySelector('#pm-cs').value)||5)*60, long:(parseInt(el.querySelector('#pm-cl').value)||15)*60 }; }
    function pSec() { const c=cfg(); return phase==='work'?c.work:phase==='short'?c.short:c.long; }
    function dots() { return Array.from({length:CYCLE},(_,i)=>`<div class="pomo-dot${i<sessions%CYCLE?' done':''}"></div>`).join(''); }
    const phLabels = {work:'Arbeitsphase', short:'Kurze Pause', long:'Lange Pause'};

    el.innerHTML = `
      <div class="card">
        <div class="pomo-phase-label" id="pm-ph">Arbeitsphase</div>
        <div class="timer-display" id="pm-disp">25:00</div>
        <div class="progress-track"><div class="progress-fill" id="pm-prog" style="width:100%"></div></div>
        <div class="pomo-dots" id="pm-dots">${dots()}</div>
      </div>
      <div class="card btn-row c3">
        <button class="btn" id="pm-tog">▶ Start</button>
        <button class="btn" id="pm-skip">⏭ Skip</button>
        <button class="btn" id="pm-reset">↺ Reset</button>
      </div>
      <div class="card">
        <span class="label">Zeiten (Minuten)</span>
        <div class="cfg-grid c3">
          <div class="cfg-field"><div class="cfg-lbl">Arbeit</div><input class="cfg-in" id="pm-cw" type="number" min="1" max="90" value="25"></div>
          <div class="cfg-field"><div class="cfg-lbl">Kurze Pause</div><input class="cfg-in" id="pm-cs" type="number" min="1" max="30" value="5"></div>
          <div class="cfg-field"><div class="cfg-lbl">Lange Pause</div><input class="cfg-in" id="pm-cl" type="number" min="1" max="60" value="15"></div>
        </div>
      </div>`;

    const disp=el.querySelector('#pm-disp'), ph=el.querySelector('#pm-ph');
    const prog=el.querySelector('#pm-prog'), dotsEl=el.querySelector('#pm-dots');
    const togB=el.querySelector('#pm-tog');

    function draw() { const t=pSec(); disp.textContent=fmt(sec,false); prog.style.width=(sec/t*100)+'%'; }
    function setPhase(p) { phase=p; sec=pSec(); ph.textContent=phLabels[p]; dotsEl.innerHTML=dots(); draw(); }
    function advance() {
        if (phase==='work') { sessions++; dotsEl.innerHTML=dots(); beepFinish(); vib([250,80,250]); setPhase(sessions%CYCLE===0?'long':'short'); }
        else { beep(660,0.2,0.18); vib(150); setPhase('work'); }
    }
    function startIv() {
        iv=setInterval(() => { sec--; draw(); if(sec<=0){clearInterval(iv);running=false;togB.textContent='▶ Start';advance();} }, 1000);
    }
    togB.addEventListener('click', () => {
        if (running) { clearInterval(iv); running=false; togB.textContent='▶ Start'; }
        else { running=true; togB.textContent='⏸ Pause'; startIv(); }
    });
    el.querySelector('#pm-skip').addEventListener('click', () => { clearInterval(iv); running=false; togB.textContent='▶ Start'; advance(); });
    el.querySelector('#pm-reset').addEventListener('click', () => { clearInterval(iv); running=false; sessions=0; togB.textContent='▶ Start'; setPhase('work'); });
    [el.querySelector('#pm-cw'),el.querySelector('#pm-cs'),el.querySelector('#pm-cl')].forEach(i => i.addEventListener('change', () => { if(!running) setPhase(phase); }));
    sec=pSec(); draw();
    return {};
}

// ============================================
// WIDGET: Interval Timer
// ============================================
function wInterval(el) {
    let running=false, iv=null, sec=0, round=1, phase='prep', totalR=0, workS=0, restS=0;

    el.innerHTML = `
      <div class="card" id="iv-cfg">
        <span class="label">Konfiguration</span>
        <div class="cfg-grid">
          <div class="cfg-field"><div class="cfg-lbl">Arbeit (Sek)</div><input class="cfg-in" id="iv-w" type="number" min="1" value="30"></div>
          <div class="cfg-field"><div class="cfg-lbl">Pause (Sek)</div><input class="cfg-in" id="iv-r" type="number" min="0" value="10"></div>
          <div class="cfg-field"><div class="cfg-lbl">Runden</div><input class="cfg-in" id="iv-n" type="number" min="1" value="8"></div>
          <div class="cfg-field"><div class="cfg-lbl">Vorlauf (Sek)</div><input class="cfg-in" id="iv-p" type="number" min="0" value="5"></div>
        </div>
      </div>
      <div class="card hidden" id="iv-run">
        <div class="status-row">
          <span id="iv-ph" class="label" style="padding:0">Vorbereitung</span>
          <span id="iv-bdg">${mkBadge('idle')}</span>
        </div>
        <div class="timer-display" id="iv-disp">00:05</div>
        <div class="progress-track"><div class="progress-fill" id="iv-prog" style="width:100%"></div></div>
        <div class="round-info">Runde <span id="iv-rnd">1</span> / <span id="iv-tot">8</span></div>
      </div>
      <div class="card btn-row c3">
        <button class="btn" id="iv-start">▶ Start</button>
        <button class="btn" id="iv-pause" disabled>⏸ Pause</button>
        <button class="btn" id="iv-reset">↺ Reset</button>
      </div>`;

    const cfgCard=el.querySelector('#iv-cfg'), runCard=el.querySelector('#iv-run');
    const disp=el.querySelector('#iv-disp'), phEl=el.querySelector('#iv-ph');
    const bdg=el.querySelector('#iv-bdg'), prog=el.querySelector('#iv-prog');
    const rndEl=el.querySelector('#iv-rnd'), totEl=el.querySelector('#iv-tot');
    const startB=el.querySelector('#iv-start'), pauseB=el.querySelector('#iv-pause');
    function tot() { return phase==='work'?workS:phase==='rest'?restS:parseInt(el.querySelector('#iv-p').value)||5; }
    function draw() {
        disp.textContent=fmt(sec,false); prog.style.width=(sec/tot()*100)+'%';
        prog.className='progress-fill'+(phase==='rest'?' warn':'');
        disp.className='timer-display'+(phase==='rest'?' warn':'');
    }
    function tick() {
        sec--; draw();
        if (sec>0) return;
        beep(phase==='work'?440:880,0.2,0.18); vib(120);
        if (phase==='prep') { phase='work'; sec=workS; phEl.textContent='Arbeit'; }
        else if (phase==='work') {
            if (round>=totalR) { clearInterval(iv);running=false;startB.disabled=false;pauseB.disabled=true;bdg.innerHTML=mkBadge('done');phEl.textContent='✓ Fertig';beepFinish();vib([200,80,200,80,200]);return; }
            phase='rest'; sec=restS; phEl.textContent='Pause';
        } else { round++; rndEl.textContent=round; phase='work'; sec=workS; phEl.textContent='Arbeit'; }
        draw();
    }
    function start() {
        if (running) return;
        if (!runCard.classList.contains('hidden')) {/* resume */}
        else {
            workS=parseInt(el.querySelector('#iv-w').value)||30;
            restS=parseInt(el.querySelector('#iv-r').value)||10;
            totalR=parseInt(el.querySelector('#iv-n').value)||8;
            const prep=parseInt(el.querySelector('#iv-p').value)||0;
            round=1; rndEl.textContent=1; totEl.textContent=totalR;
            phase=prep>0?'prep':'work'; sec=prep>0?prep:workS;
            phEl.textContent=prep>0?'Vorbereitung':'Arbeit';
            cfgCard.classList.add('hidden'); runCard.classList.remove('hidden'); draw();
        }
        running=true; startB.disabled=true; pauseB.disabled=false; bdg.innerHTML=mkBadge('running');
        iv=setInterval(tick,1000);
    }
    function pause() { clearInterval(iv);running=false;startB.disabled=false;pauseB.disabled=true;bdg.innerHTML=mkBadge('paused'); }
    function reset() { clearInterval(iv);running=false;cfgCard.classList.remove('hidden');runCard.classList.add('hidden');startB.disabled=false;pauseB.disabled=true;bdg.innerHTML=mkBadge('idle'); }
    startB.addEventListener('click',start); pauseB.addEventListener('click',pause);
    el.querySelector('#iv-reset').addEventListener('click',reset);
    return {};
}

// ============================================
// WIDGET: World Clock
// ============================================
function wWorldClock(el) {
    const ZONES=[
        {city:'New York',   zone:'America/New_York',   flag:'🇺🇸'},
        {city:'London',     zone:'Europe/London',      flag:'🇬🇧'},
        {city:'Berlin',     zone:'Europe/Berlin',      flag:'🇩🇪'},
        {city:'Dubai',      zone:'Asia/Dubai',         flag:'🇦🇪'},
        {city:'Singapur',   zone:'Asia/Singapore',     flag:'🇸🇬'},
        {city:'Tokio',      zone:'Asia/Tokyo',         flag:'🇯🇵'},
        {city:'Sydney',     zone:'Australia/Sydney',   flag:'🇦🇺'},
        {city:'L.A.',       zone:'America/Los_Angeles',flag:'🇺🇸'},
    ];
    el.innerHTML = `<div class="card">${ZONES.map(z=>`
        <div class="tz-item" data-zone="${z.zone}">
          <div><div class="tz-city">${z.flag} ${z.city}</div><div class="tz-zone">${z.zone}</div></div>
          <div class="tz-right"><div class="tz-time" data-t></div><div class="tz-date" data-d></div></div>
        </div>`).join('')}</div>`;
    let ticker=null;
    function update() {
        const now=new Date();
        el.querySelectorAll('.tz-item').forEach(item => {
            const z=item.dataset.zone;
            item.querySelector('[data-t]').textContent=now.toLocaleTimeString('de-DE',{timeZone:z,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
            item.querySelector('[data-d]').textContent=now.toLocaleDateString('de-DE',{timeZone:z,weekday:'short',day:'2-digit',month:'2-digit'});
        });
    }
    return { onShow:()=>{update();ticker=setInterval(update,1000);}, onHide:()=>clearInterval(ticker) };
}

// ── Boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
