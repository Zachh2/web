/* ============================================================================
   ZACH_CORE — palette.js
   Global ⌘K / Ctrl+K command palette. Self-contained: injects its own DOM and
   styles on load, touches nothing that already exists on the page, and calls
   only endpoints the dashboard already uses.
   ========================================================================= */
(function () {
    'use strict';
    if (window.__zcPalette) return;
    // no palette on the auth screen — nothing it offers is reachable pre-login
    if (/\/login(\.html)?$/.test(location.pathname)) return;
    window.__zcPalette = true;

    /* ---------- styles (scoped to .zcp- prefix) ---------- */
    const css = `
    .zcp-veil{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-start;
      justify-content:center;padding-top:12vh;background:rgba(3,5,10,.72);
      backdrop-filter:blur(10px) saturate(120%);-webkit-backdrop-filter:blur(10px)}
    .zcp-veil.on{display:flex}
    .zcp-box{width:min(680px,94vw);border-radius:1.4rem;overflow:hidden;
      background:linear-gradient(rgba(17,22,32,.94),rgba(17,22,32,.94)) padding-box,
                 linear-gradient(140deg,#6366f1,#22d3ee 55%,#d946ef) border-box;
      border:1px solid transparent;
      box-shadow:0 40px 120px -40px #000,0 0 0 1px rgba(255,255,255,.04) inset;
      animation:zcp-in .18s cubic-bezier(.34,1.56,.64,1) both;
      font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif}
    @keyframes zcp-in{from{opacity:0;transform:translateY(-10px) scale(.97)}to{opacity:1;transform:none}}
    .zcp-top{display:flex;align-items:center;gap:12px;padding:18px 20px;
      border-bottom:1px solid rgba(99,118,160,.16)}
    .zcp-top svg{flex:none;width:18px;height:18px;color:#6366f1}
    .zcp-in{flex:1;background:transparent;border:0;outline:0;color:#fff;font-size:15px;
      font-family:'JetBrains Mono','Fira Code',monospace}
    .zcp-in::placeholder{color:rgba(148,163,184,.4)}
    .zcp-hint{font-family:'JetBrains Mono',monospace;font-size:9px;padding:3px 6px;border-radius:6px;
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#94a3b8}
    .zcp-list{max-height:52vh;overflow-y:auto;padding:8px}
    .zcp-grp{font-size:8px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;
      color:#475569;padding:12px 14px 6px}
    .zcp-it{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;
      cursor:pointer;transition:background .12s}
    .zcp-it[data-sel="1"]{background:linear-gradient(90deg,rgba(99,102,241,.24),rgba(34,211,238,.08));
      box-shadow:inset 2px 0 0 0 #6366f1}
    .zcp-ic{width:26px;height:26px;flex:none;border-radius:8px;display:flex;align-items:center;
      justify-content:center;font-size:12px;background:rgba(99,102,241,.14)}
    .zcp-tx{flex:1;min-width:0}
    .zcp-t{color:#e2e8f0;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis}
    .zcp-s{color:#64748b;font-size:9px;font-family:'JetBrains Mono',monospace;letter-spacing:.08em;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
    .zcp-tag{font-size:7px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
      padding:3px 7px;border-radius:6px;background:rgba(255,255,255,.05);color:#94a3b8;flex:none}
    .zcp-mk{color:#22d3ee;font-weight:700}
    .zcp-foot{display:flex;gap:14px;padding:10px 18px;border-top:1px solid rgba(99,118,160,.16);
      font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#475569;align-items:center}
    .zcp-empty{padding:36px;text-align:center;color:#475569;font-size:10px;letter-spacing:.18em;
      text-transform:uppercase;font-family:'JetBrains Mono',monospace}
    .zcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;
      padding:12px 22px;border-radius:12px;font-size:11px;font-family:'JetBrains Mono',monospace;
      background:rgba(17,22,32,.96);border:1px solid rgba(99,102,241,.45);color:#e2e8f0;
      box-shadow:0 20px 50px -20px #000;animation:zcp-in .2s both}
    .zcp-fab{position:fixed;right:18px;bottom:18px;z-index:9998;width:46px;height:46px;border-radius:14px;
      display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;
      background:linear-gradient(135deg,#6366f1,#4338ca);border:1px solid rgba(129,140,248,.5);
      box-shadow:0 10px 30px -10px rgba(99,102,241,.9);transition:transform .18s,box-shadow .2s}
    .zcp-fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 40px -10px rgba(99,102,241,1)}
    .zcp-fab:active{transform:scale(.94)}
    @media(min-width:900px){.zcp-fab{display:none}}
    @media(prefers-reduced-motion:reduce){.zcp-box,.zcp-toast{animation:none}}
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    /* ---------- DOM ---------- */
    const veil = document.createElement('div');
    veil.className = 'zcp-veil';
    veil.innerHTML = `
      <div class="zcp-box" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="zcp-top">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <input class="zcp-in" placeholder="Run a command, jump to a thread, or type a page..." spellcheck="false" autocomplete="off">
          <span class="zcp-hint">ESC</span>
        </div>
        <div class="zcp-list"></div>
        <div class="zcp-foot">
          <span><span class="zcp-hint">↑↓</span> navigate</span>
          <span><span class="zcp-hint">↵</span> run</span>
          <span><span class="zcp-hint">⌘K</span> toggle</span>
          <span style="margin-left:auto" id="zcp-count"></span>
        </div>
      </div>`;
    document.body.appendChild(veil);

    const fab = document.createElement('div');
    fab.className = 'zcp-fab';
    fab.title = 'Command palette';
    fab.innerHTML = `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
    document.body.appendChild(fab);

    const input = veil.querySelector('.zcp-in');
    const list  = veil.querySelector('.zcp-list');
    const count = veil.querySelector('#zcp-count');

    /* ---------- state ---------- */
    let items = [], view = [], sel = 0, loaded = false, pendingThread = null;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

    function toast(msg, ok) {
        const t = document.createElement('div');
        t.className = 'zcp-toast';
        t.style.borderColor = ok === false ? 'rgba(244,63,94,.6)' : 'rgba(99,102,241,.45)';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2600);
    }

    /* ---------- fuzzy match: subsequence with contiguity bonus ---------- */
    function fuzzy(hay, needle) {
        if (!needle) return { score: 0, hits: [] };
        const h = hay.toLowerCase(), n = needle.toLowerCase();
        let hi = 0, score = 0, streak = 0;
        const hits = [];
        for (let i = 0; i < n.length; i++) {
            const c = n[i];
            if (c === ' ') continue;
            const at = h.indexOf(c, hi);
            if (at === -1) return null;
            hits.push(at);
            streak = at === hi ? streak + 1 : 0;
            score += 10 + streak * 6;
            if (at === 0 || /[\s\-_/.]/.test(h[at - 1])) score += 12;  // word start
            score -= Math.min(at - hi, 12);                             // gap penalty
            hi = at + 1;
        }
        return { score, hits };
    }

    function mark(text, hits) {
        if (!hits || !hits.length) return esc(text);
        const set = new Set(hits);
        let out = '';
        for (let i = 0; i < text.length; i++)
            out += set.has(i) ? '<span class="zcp-mk">' + esc(text[i]) + '</span>' : esc(text[i]);
        return out;
    }

    /* ---------- static actions ---------- */
    const NAV = [
        { g: 'Navigate', icon: '◧', title: 'Dashboard',       sub: '/',               run: () => location.href = '/' },
        { g: 'Navigate', icon: '⌘', title: 'Command Center',  sub: '/commands.html',       run: () => location.href = '/commands.html' },
        { g: 'Navigate', icon: '▤', title: 'File Management', sub: '/filemanagement', run: () => location.href = '/filemanagement' },
        { g: 'Navigate', icon: '>_', icon2: 1, title: 'Terminal', sub: '/terminal',   run: () => location.href = '/terminal' },
        { g: 'System',   icon: '↻', title: 'Restart bot',  sub: '/api/system/restart?action=1',
          run: () => sys('restart', 1) },
        { g: 'System',   icon: '⏻', title: 'Shutdown bot', sub: '/api/system/restart?action=2',
          run: () => sys('shutdown', 2) },
        { g: 'System',   icon: '⎋', title: 'Log out',      sub: '/api/auth/logout',
          run: async () => { try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {} location.href = '/login'; } },
    ];

    async function sys(label, code) {
        if (!confirm('Really ' + label + ' the bot?')) return;
        try {
            const r = await fetch('/api/system/restart?action=' + code);
            const d = await r.json().catch(() => ({}));
            toast(d.success ? (d.message || label + ' signal sent')
                            : (d.error || 'Failed (HTTP ' + r.status + ')'), !!d.success);
        } catch (e) { toast(e.message, false); }
    }

    /* ---------- data loading (parallel, failure-tolerant) ---------- */
    async function load() {
        if (loaded) return;
        loaded = true;
        const out = [...NAV];

        const [cmds, threads] = await Promise.all([
            (async () => {
                try {
                    const files = await (await fetch('/api/files/list?path=commands')).json();
                    return (files || []).filter(f => !f.isDirectory && /\.js$/i.test(f.name));
                } catch (e) { return []; }
            })(),
            (async () => {
                try {
                    const d = await (await fetch('/api/thread/list')).json();
                    return d.threads || [];
                } catch (e) { return []; }
            })(),
        ]);

        // Filenames are NOT command names — spt.js is /spotify, autodl.js is /adown.
        // Show filenames instantly, then resolve real config.name in the background.
        cmds.forEach(f => {
            const file = f.name.replace(/\.js$/i, '');
            out.push({
                g: 'Run command', icon: '▸', title: '/' + file, sub: f.name,
                file: f.name, resolved: false,
                run() { askThread(this.title.slice(1)); }
            });
        });

        threads.forEach(t => {
            out.push({
                g: 'Threads', icon: '◎', title: t.name || 'Unknown',
                sub: t.threadID + (t.participants ? ' · ' + t.participants + 'P' : ''),
                run: () => { pendingThread = t.threadID; input.value = ''; input.placeholder = 'Message for ' + (t.name || t.threadID) + '...'; render(); }
            });
        });

        items = out;
        render();
        resolveNames();
    }

    /* ---------- resolve real command names (cached for the session) ---------- */
    async function resolveNames() {
        let cache = {};
        try { cache = JSON.parse(sessionStorage.getItem('zcp:names') || '{}'); } catch (e) {}

        const pending = items.filter(i => i.file && !i.resolved);
        let changed = false;

        // apply anything already cached, instantly
        pending.forEach(i => {
            if (cache[i.file]) { i.title = '/' + cache[i.file]; i.sub = i.file; i.resolved = true; changed = true; }
        });
        if (changed) render();

        const todo = pending.filter(i => !i.resolved);
        if (!todo.length) return;

        let idx = 0;
        await Promise.all(Array.from({ length: Math.min(5, todo.length) }, async () => {
            while (idx < todo.length) {
                const it = todo[idx++];
                try {
                    const d = await (await fetch('/api/files/read?path=' + encodeURIComponent('commands/' + it.file))).json();
                    const m = (d.content || '').match(/name\s*:\s*["'`]([^"'`]+)["'`]/);
                    if (m) { it.title = '/' + m[1]; it.sub = it.file; cache[it.file] = m[1]; }
                } catch (e) { /* keep the filename fallback */ }
                it.resolved = true;
            }
        }));

        try { sessionStorage.setItem('zcp:names', JSON.stringify(cache)); } catch (e) {}
        render();
    }

    function askThread(cmdName) {
        const threads = items.filter(i => i.g === 'Threads');
        if (!threads.length) { toast('No threads available', false); return; }
        list.innerHTML = '<div class="zcp-grp">Send /' + esc(cmdName) + ' to…</div>' +
            threads.map((t, i) => `<div class="zcp-it" data-sel="${i === 0 ? 1 : 0}" data-cmd="${esc(cmdName)}" data-tid="${esc(t.sub.split(' ')[0])}">
                <div class="zcp-ic">◎</div><div class="zcp-tx"><div class="zcp-t">${esc(t.title)}</div>
                <div class="zcp-s">${esc(t.sub)}</div></div><div class="zcp-tag">send</div></div>`).join('');
        list.querySelectorAll('[data-tid]').forEach(el => {
            el.onclick = () => send(el.dataset.tid, '/' + el.dataset.cmd);
        });
        sel = 0;
    }

    async function send(id, msg) {
        close();
        try {
            const r = await fetch(`/api/thread/send?id=${encodeURIComponent(id)}&message=${encodeURIComponent(msg)}`);
            toast(r.ok ? 'Sent ' + msg : 'Send failed (HTTP ' + r.status + ')', r.ok);
        } catch (e) { toast(e.message, false); }
    }

    /* ---------- render ---------- */
    function render() {
        const q = input.value.trim();

        if (pendingThread) {
            list.innerHTML = `<div class="zcp-grp">Message thread ${esc(pendingThread)}</div>
                <div class="zcp-it" data-sel="1"><div class="zcp-ic">✉</div><div class="zcp-tx">
                <div class="zcp-t">${q ? esc(q) : 'Type your message…'}</div>
                <div class="zcp-s">press ENTER to send</div></div></div>`;
            count.textContent = '';
            return;
        }

        view = !q ? items.map(it => ({ it, score: 0, hits: [] }))
                  : items.map(it => {
                        const a = fuzzy(it.title, q), b = fuzzy(it.sub || '', q);
                        if (!a && !b) return null;
                        return a && (!b || a.score >= b.score)
                            ? { it, score: a.score + 20, hits: a.hits }
                            : { it, score: b.score, hits: [] };
                    }).filter(Boolean).sort((x, y) => y.score - x.score);

        view = view.slice(0, 60);
        count.textContent = view.length + ' result' + (view.length === 1 ? '' : 's');

        if (!view.length) { list.innerHTML = '<div class="zcp-empty">No matches</div>'; return; }
        if (sel >= view.length) sel = 0;

        let html = '', group = null;
        view.forEach((v, i) => {
            if (v.it.g !== group) { group = v.it.g; html += `<div class="zcp-grp">${esc(group)}</div>`; }
            html += `<div class="zcp-it" data-sel="${i === sel ? 1 : 0}" data-i="${i}">
                <div class="zcp-ic">${esc(v.it.icon)}</div>
                <div class="zcp-tx"><div class="zcp-t">${mark(v.it.title, v.hits)}</div>
                <div class="zcp-s">${esc(v.it.sub || '')}</div></div>
                <div class="zcp-tag">${esc(v.it.g)}</div></div>`;
        });
        list.innerHTML = html;
        list.querySelectorAll('[data-i]').forEach(el => {
            el.onclick = () => { sel = +el.dataset.i; exec(); };
            el.onmouseenter = () => { sel = +el.dataset.i; paint(); };
        });
    }

    function paint() {
        list.querySelectorAll('[data-i]').forEach(el =>
            el.dataset.sel = (+el.dataset.i === sel) ? '1' : '0');
    }

    function exec() {
        if (pendingThread) {
            const msg = input.value.trim();
            if (!msg) return;
            const id = pendingThread; pendingThread = null;
            send(id, msg);
            return;
        }
        const v = view[sel];
        if (!v) return;
        const keepOpen = v.it.g === 'Run command' || v.it.g === 'Threads';
        if (!keepOpen) close();
        v.it.run();
    }

    /* ---------- open / close ---------- */
    function open() {
        veil.classList.add('on');
        input.value = ''; input.placeholder = 'Run a command, jump to a thread, or type a page...';
        pendingThread = null; sel = 0;
        load(); render();
        setTimeout(() => input.focus(), 20);
    }
    function close() {
        veil.classList.remove('on');
        pendingThread = null;
    }

    fab.onclick = open;
    veil.addEventListener('click', e => { if (e.target === veil) close(); });
    input.addEventListener('input', () => { sel = 0; render(); });

    document.addEventListener('keydown', e => {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); veil.classList.contains('on') ? close() : open(); return; }
        if (!veil.classList.contains('on')) return;
        if (e.key === 'Escape')    { e.preventDefault(); close(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, Math.max(view.length - 1, 0)); paint(); scrollSel(); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); scrollSel(); }
        if (e.key === 'Enter')     { e.preventDefault(); exec(); }
    });

    function scrollSel() {
        const el = list.querySelector('[data-sel="1"]');
        if (el) el.scrollIntoView({ block: 'nearest' });
    }
})();
