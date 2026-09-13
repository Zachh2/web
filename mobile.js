/* ============================================================================
   ZACH_CORE — mobile.js
   Touch behaviour: swipe between tabs, pull-to-refresh, haptics, iOS viewport
   correction, PWA install prompt. No-ops entirely on non-touch devices.
   ========================================================================= */
(function () {
    'use strict';
    if (window.__zcMobile) return;
    window.__zcMobile = true;

    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    /* ---------- 1. iOS viewport height ----------------------------------
       Mobile Safari's 100vh includes chrome that collapses on scroll, so any
       full-height element jumps. Publish a real value as --vh.             */
    function setVH() {
        document.documentElement.style.setProperty('--vh', window.innerHeight * 0.01 + 'px');
    }
    setVH();
    addEventListener('resize', setVH);
    addEventListener('orientationchange', () => setTimeout(setVH, 120));

    /* ---------- 2. haptics ---------------------------------------------- */
    const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

    if (isTouch) {
        document.addEventListener('click', (e) => {
            const t = e.target.closest('button, .chip, .zcp-it, nav a, [onclick]');
            if (t) buzz(8);
        }, { passive: true });
    }

    if (!isTouch) return;   // everything below is touch-only

    /* ---------- 3. swipe between dashboard tabs --------------------------
       Derives tab order from the existing nav buttons, so it stays correct
       if tabs are added or reordered.                                      */
    function tabOrder() {
        return [...document.querySelectorAll('nav [id^="nav-"]')]
            .map(b => b.id.replace(/^nav-/, ''));
    }

    function activeTab() {
        const el = document.querySelector('nav [id^="nav-"].nav-active');
        return el ? el.id.replace(/^nav-/, '') : null;
    }

    let sx = 0, sy = 0, tracking = false;

    addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        // ignore gestures that start inside something scrollable sideways
        if (e.target.closest('.overflow-x-auto, input, textarea, .zcp-veil, #edit')) return;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        if (typeof window.switchTab !== 'function') return;

        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;  // must be clearly horizontal

        const order = tabOrder();
        const cur = order.indexOf(activeTab());
        if (cur === -1) return;

        const next = dx < 0 ? cur + 1 : cur - 1;
        if (next < 0 || next >= order.length) return;

        buzz(12);
        window.switchTab(order[next]);
    }, { passive: true });

    /* ---------- 4. pull to refresh --------------------------------------- */
    const ptr = document.createElement('div');
    ptr.className = 'zc-ptr';
    ptr.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
    document.body.appendChild(ptr);

    const THRESHOLD = 62;
    let py = 0, pulling = false, armed = false;

    addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (window.scrollY > 2) return;
        if (e.target.closest('.zcp-veil, .modal-overlay.active, .zct, #edit')) return;
        py = e.touches[0].clientY;
        pulling = true;
        armed = false;
    }, { passive: true });

    addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const dy = e.touches[0].clientY - py;
        if (dy <= 0) { ptr.style.transform = 'translate(-50%, -60px)'; return; }

        const eased = Math.min(dy * 0.62, 88);         // resistance
        ptr.style.transform = `translate(-50%, ${eased - 50}px) rotate(${eased * 4}deg)`;
        ptr.style.opacity = Math.min(eased / THRESHOLD, 1);

        if (!armed && eased >= THRESHOLD * 0.72) { armed = true; buzz(14); }
    }, { passive: true });

    addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;

        if (armed) {
            ptr.classList.add('spin');
            ptr.style.transform = 'translate(-50%, 22px)';
            buzz([10, 40, 10]);
            refresh().finally(() => {
                setTimeout(() => {
                    ptr.classList.remove('spin');
                    ptr.style.transform = 'translate(-50%, -60px)';
                    ptr.style.opacity = 0;
                }, 350);
            });
        } else {
            ptr.style.transform = 'translate(-50%, -60px)';
            ptr.style.opacity = 0;
        }
        armed = false;
    }, { passive: true });

    /* Re-run the page's own loaders rather than reloading, so state is kept.
       Falls back to a hard reload when this page exposes nothing to call.   */
    async function refresh() {
        const calls = [];
        if (typeof window.updateStats === 'function') calls.push(window.updateStats());

        const tab = activeTab();
        const map = {
            threads:    'loadThreads',
            banning:    'loadBanning',
            user:       'loadUsers',
            currencies: 'loadCurrencies',
        };
        const fn = map[tab];
        if (fn && typeof window[fn] === 'function') calls.push(window[fn]());
        if (typeof window.scanCommands === 'function') calls.push(window.scanCommands(true));

        if (!calls.length) { location.reload(); return; }
        try { await Promise.all(calls); } catch (e) {}
    }

    /* ---------- 5. keep the palette usable with the keyboard open --------- */
    if (window.visualViewport) {
        const veil = () => document.querySelector('.zcp-veil');
        visualViewport.addEventListener('resize', () => {
            const v = veil();
            if (v && v.classList.contains('on')) {
                v.style.paddingTop = Math.max(visualViewport.height * 0.06, 12) + 'px';
            }
        });
    }
})();
