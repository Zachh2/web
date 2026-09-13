/* ============================================================================
   ZACH_CORE — telemetry.js
   Always-on live HUD: RAM + latency sparklines, service pips, accent switcher.
   Self-contained. Polls only endpoints the dashboard already uses.
   ========================================================================= */
(function () {
    'use strict';
    if (window.__zcTelemetry) return;
    if (/\/login(\.html)?$/.test(location.pathname)) return;
    window.__zcTelemetry = true;

    const POLL = 4000;      // ms between samples
    const KEEP = 48;        // samples retained per series

    /* ---------- accent palettes ---------- */
    const ACCENTS = [
        { id: 'indigo',  a: '#6366f1', b: '#22d3ee', c: '#d946ef' },
        { id: 'emerald', a: '#10b981', b: '#22d3ee', c: '#a3e635' },
        { id: 'amber',   a: '#f59e0b', b: '#f43f5e', c: '#fbbf24' },
        { id: 'rose',    a: '#f43f5e', b: '#d946ef', c: '#fb7185' },
    ];
    let accent = 0;
    try { accent = Math.max(0, ACCENTS.findIndex(x => x.id === localStorage.getItem('zc:accent'))) || 0; } catch (e) {}

    function applyAccent() {
        const t = ACCENTS[accent];
        const r = document.documentElement.style;
        r.setProperty('--accent', t.a);
        r.setProperty('--cyan', t.b);
        r.setProperty('--magenta', t.c);
        r.setProperty('--line-hot', t.a + '8c');
        try { localStorage.setItem('zc:accent', t.id); } catch (e) {}
    }
    applyAccent();

    /* ---------- styles ---------- */
    const css = `
    .zct{position:fixed;left:16px;bottom:16px;z-index:9997;width:230px;border-radius:1.1rem;
      overflow:hidden;font-family:'JetBrains Mono','Fira Code',monospace;
      background:linear-gradient(rgba(13,17,26,.92),rgba(13,17,26,.92)) padding-box,
                 linear-gradient(140deg,var(--accent,#6366f1),var(--cyan,#22d3ee) 60%,var(--magenta,#d946ef)) border-box;
      border:1px solid transparent;backdrop-filter:blur(14px) saturate(140%);
      -webkit-backdrop-filter:blur(14px) saturate(140%);
      box-shadow:0 24px 60px -30px #000,0 0 0 1px rgba(255,255,255,.04) inset;
      transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .3s}
    .zct.min{transform:translateY(calc(100% - 34px))}
    .zct-h{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;
      border-bottom:1px solid rgba(120,140,190,.14);user-select:none}
    .zct-live{width:6px;height:6px;border-radius:50%;background:var(--accent,#6366f1);flex:none;
      box-shadow:0 0 8px var(--accent,#6366f1);animation:zct-bl 1.6s ease-in-out infinite}
    @keyframes zct-bl{50%{opacity:.25}}
    .zct-ti{flex:1;font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;font-weight:700}
    .zct-btn{font-size:9px;color:#475569;padding:2px 5px;border-radius:5px;transition:.15s;cursor:pointer}
    .zct-btn:hover{color:#e2e8f0;background:rgba(255,255,255,.07)}
    .zct-b{padding:10px 12px 12px}
    .zct-row{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:3px}
    .zct-k{font-size:7px;letter-spacing:.18em;text-transform:uppercase;color:#475569}
    .zct-v{font-size:11px;color:#e2e8f0;font-variant-numeric:tabular-nums;font-weight:600}
    .zct-c{width:100%;height:30px;display:block;margin-bottom:9px;border-radius:5px}
    .zct-pips{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px;
      padding-top:9px;border-top:1px solid rgba(120,140,190,.14)}
    .zct-pip{display:flex;align-items:center;gap:4px;font-size:7px;letter-spacing:.12em;
      text-transform:uppercase;color:#64748b;padding:3px 6px;border-radius:5px;background:rgba(255,255,255,.04)}
    .zct-dot{width:5px;height:5px;border-radius:50%;flex:none;background:#475569}
    .zct-dot.ok{background:#10b981;box-shadow:0 0 6px #10b981}
    .zct-dot.no{background:#f43f5e;box-shadow:0 0 6px #f43f5e}
    .zct-sw{display:flex;gap:4px;margin-top:9px}
    .zct-s{width:14px;height:14px;border-radius:4px;cursor:pointer;border:1px solid rgba(255,255,255,.18);
      transition:transform .15s}
    .zct-s:hover{transform:scale(1.18)}
    @media(max-width:900px){.zct{display:none}}
    @media(prefers-reduced-motion:reduce){.zct-live{animation:none}}
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    /* ---------- DOM ---------- */
    const el = document.createElement('div');
    el.className = 'zct';
    el.innerHTML = `
      <div class="zct-h">
        <span class="zct-live"></span>
        <span class="zct-ti">Telemetry</span>
        <span class="zct-btn" data-min>—</span>
      </div>
      <div class="zct-b">
        <div class="zct-row"><span class="zct-k">Memory</span><span class="zct-v" data-ram>--%</span></div>
        <canvas class="zct-c" data-c="ram" width="412" height="60"></canvas>
        <div class="zct-row"><span class="zct-k">Latency</span><span class="zct-v" data-lat>-- ms</span></div>
        <canvas class="zct-c" data-c="lat" width="412" height="60"></canvas>
        <div class="zct-pips">
          <span class="zct-pip"><i class="zct-dot" data-p="bot"></i>Bot</span>
          <span class="zct-pip"><i class="zct-dot" data-p="db"></i>DB</span>
          <span class="zct-pip"><i class="zct-dot" data-p="lock"></i>Lock</span>
          <span class="zct-pip" data-threads>-- TH</span>
        </div>
        <div class="zct-sw"></div>
      </div>`;
    document.body.appendChild(el);

    const $ = s => el.querySelector(s);
    const ramV = $('[data-ram]'), latV = $('[data-lat]'), thV = $('[data-threads]');
    const cRam = $('[data-c="ram"]'), cLat = $('[data-c="lat"]');

    /* minimise toggle, remembered */
    try { if (localStorage.getItem('zc:tel') === 'min') el.classList.add('min'); } catch (e) {}
    $('.zct-h').onclick = () => {
        el.classList.toggle('min');
        try { localStorage.setItem('zc:tel', el.classList.contains('min') ? 'min' : 'open'); } catch (e) {}
    };

    /* accent swatches */
    const sw = $('.zct-sw');
    ACCENTS.forEach((t, i) => {
        const b = document.createElement('span');
        b.className = 'zct-s';
        b.style.background = `linear-gradient(135deg,${t.a},${t.b} 60%,${t.c})`;
        b.title = t.id;
        b.onclick = e => { e.stopPropagation(); accent = i; applyAccent(); paint(); };
        sw.appendChild(b);
    });

    /* ---------- series ---------- */
    const ram = [], lat = [];
    const push = (arr, v) => { arr.push(v); if (arr.length > KEEP) arr.shift(); };

    /* ---------- sparkline renderer ---------- */
    function spark(cv, data, max) {
        const ctx = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        if (data.length < 2) return;

        const top = ACCENTS[accent];
        const hi = Math.max(max || 1, ...data) * 1.15;
        const x = i => (i / (data.length - 1)) * W;
        const y = v => H - (v / hi) * (H - 6) - 3;

        // baseline grid
        ctx.strokeStyle = 'rgba(120,140,190,.10)';
        ctx.lineWidth = 1;
        for (let g = 1; g < 3; g++) {
            ctx.beginPath(); ctx.moveTo(0, H / 3 * g); ctx.lineTo(W, H / 3 * g); ctx.stroke();
        }

        // smooth path
        const path = new Path2D();
        path.moveTo(x(0), y(data[0]));
        for (let i = 1; i < data.length; i++) {
            const xc = (x(i - 1) + x(i)) / 2;
            path.quadraticCurveTo(xc, y(data[i - 1]), x(i), y(data[i]));
        }

        // area fill
        const fill = new Path2D(path);
        fill.lineTo(W, H); fill.lineTo(0, H); fill.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, top.a + '66');
        g.addColorStop(1, top.a + '00');
        ctx.fillStyle = g; ctx.fill(fill);

        // stroke
        const lg = ctx.createLinearGradient(0, 0, W, 0);
        lg.addColorStop(0, top.a); lg.addColorStop(1, top.b);
        ctx.strokeStyle = lg; ctx.lineWidth = 2;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowColor = top.a; ctx.shadowBlur = 8;
        ctx.stroke(path);
        ctx.shadowBlur = 0;

        // head dot
        const lx = x(data.length - 1), ly = y(data[data.length - 1]);
        ctx.beginPath(); ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
    }

    function paint() {
        spark(cRam, ram, 100);
        spark(cLat, lat, 200);
    }

    const pip = (name, state) => {
        const d = el.querySelector(`[data-p="${name}"]`);
        if (d) d.className = 'zct-dot' + (state === true ? ' ok' : state === false ? ' no' : '');
    };

    /* ---------- poll ---------- */
    async function tick() {
        const t0 = performance.now();
        let sys = null, db = null, th = null;

        try {
            const [a, b, c] = await Promise.all([
                fetch('/api/system/stats').then(r => r.json()).catch(() => null),
                fetch('/api/db/status').then(r => r.json()).catch(() => null),
                fetch('/api/thread/list').then(r => r.json()).catch(() => null),
            ]);
            sys = a; db = b; th = c;
        } catch (e) { /* keep last known values */ }

        const ms = Math.round(performance.now() - t0);
        push(lat, ms);
        latV.textContent = ms + ' ms';

        if (sys) {
            const r = Number(sys.memory?.usagePercent ?? sys.memory?.percent ?? sys.ram ?? 0) || 0;
            push(ram, r);
            ramV.textContent = r + '%';
            ramV.style.color = r > 90 ? '#f43f5e' : r > 70 ? '#f59e0b' : '#e2e8f0';
            pip('bot', !!sys.botActive);
            pip('lock', sys.isLocked === true ? false : true);
        }
        if (db) pip('db', !!db.DBConnected);
        if (th && Array.isArray(th.threads)) thV.textContent = th.threads.length + ' TH';

        paint();
    }

    tick();
    let timer = setInterval(tick, POLL);

    // stop polling while the tab is hidden, resume on return
    document.addEventListener('visibilitychange', () => {
        clearInterval(timer);
        if (!document.hidden) { tick(); timer = setInterval(tick, POLL); }
    });
})();
