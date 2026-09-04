/**
 * Browser frame: a tall page screenshot scrolls itself inside a desktop window.
 *
 * The frame is a fixed window; the screenshot inside it is several times
 * taller. This walks the picture down at a steady reading pace, holds at the
 * footer, then snaps back to the top the way a "go to top" control does, and
 * repeats. Timing is its own, not the page's, so it never fights Locomotive.
 *
 * The loop only advances while the frame is on screen, and it rewinds whenever
 * the frame leaves: arriving at the component always starts from the hero
 * rather than dropping the visitor into the middle of somebody else's footer.
 */
(function () {
    var SPEED = 260;      // px per second on the way down: reading pace
    var HOLD_END = 2000;  // pause on the footer
    var RETURN = 480;     // the snap back to the top
    var HOLD_TOP = 900;   // beat before setting off again

    var raf = 0;
    var running = false;
    var live = false;
    var phase = 'down';
    var since = 0;

    // Fast out of the gate, settling at the end: the shape of a go-to-top jump.
    function easeOutCubic(t) {
        var u = 1 - t;
        return 1 - u * u * u;
    }

    function frame(now) {
        raf = 0;
        var section = document.querySelector('[data-browser-frame]');
        var viewport = section && section.querySelector('.cs-browser-viewport');
        var page = viewport && viewport.querySelector('.cs-browser-page');
        if (!section || !viewport || !page) { running = false; return; }

        var rect = viewport.getBoundingClientRect();
        var vh = window.innerHeight;
        var onScreen = rect.bottom > 0 && rect.top < vh;

        // Promoting the screenshot costs a layer several viewports tall, so
        // carry that only while the frame is actually in play.
        if (onScreen !== live) {
            live = onScreen;
            section.classList.toggle('is-live', onScreen);
        }

        var travel = page.offsetHeight - viewport.offsetHeight;

        if (!onScreen || travel <= 24) {
            // Rewind so the next arrival starts at the top of the page.
            phase = 'down';
            since = now;
            page.style.transform = '';
            raf = requestAnimationFrame(frame);
            return;
        }

        if (!since) since = now;
        var elapsed = now - since;
        var down = (travel / SPEED) * 1000;
        var offset = 0;

        if (phase === 'down') {
            if (elapsed >= down) { phase = 'end'; since = now; offset = travel; }
            else offset = travel * (elapsed / down);
        } else if (phase === 'end') {
            offset = travel;
            if (elapsed >= HOLD_END) { phase = 'up'; since = now; }
        } else if (phase === 'up') {
            if (elapsed >= RETURN) { phase = 'top'; since = now; offset = 0; }
            else offset = travel * (1 - easeOutCubic(elapsed / RETURN));
        } else {
            offset = 0;
            if (elapsed >= HOLD_TOP) { phase = 'down'; since = now; }
        }

        page.style.transform = 'translate3d(0,' + (-offset).toFixed(1) + 'px,0)';
        raf = requestAnimationFrame(frame);
    }

    function arm() {
        if (running) return;
        if (!document.querySelector('[data-browser-frame]')) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        running = true;
        phase = 'down';
        since = 0;
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (document.readyState === 'complete') {
            arm();
        } else {
            window.addEventListener('load', arm, { once: true });
        }
    }

    function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        running = false;
        // Barba swaps in a fresh section carrying no class, so a stale `live`
        // would make the next frame think it had already applied it.
        live = false;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    // Re-arm across Barba page transitions.
    if (typeof barba !== 'undefined' && barba.hooks) {
        barba.hooks.beforeLeave(stop);
        barba.hooks.after(start);
    }
})();
