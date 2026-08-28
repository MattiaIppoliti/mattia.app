/**
 * Horizontal strip: reaching the wide image turns the scroll sideways.
 *
 * The section is one viewport tall plus the image's overhang (see .h-strip in
 * the page's own stylesheet), so the extra scroll distance is exactly the
 * distance the image has to travel. Over that stretch this holds the frame
 * still and slides the image left by the same number of pixels the page
 * scrolled — 1:1, so a scroll gesture reads as pushing the picture sideways.
 * Past the far edge the frame is released and the page scrolls on as normal.
 *
 * Progress comes from the section's own viewport rect. Locomotive translates
 * each [data-scroll-section] individually, so the rect already reflects the
 * smoothed scroll position, and no ScrollTrigger pin is needed (pinning fights
 * Locomotive's transforms).
 */
(function () {
    var raf = 0;
    var running = false;
    var live = false;

    function frame() {
        raf = 0;
        var section = document.querySelector('.h-strip');
        var viewport = section && section.querySelector('.h-strip-viewport');
        var track = viewport && viewport.querySelector('.h-strip-track');
        if (!section || !viewport || !track) { running = false; return; }

        var rect = section.getBoundingClientRect();
        var vh = window.innerHeight;

        // Promoting the track costs a layer as wide as the picture, near 12 MB
        // here, so .is-live carries that promotion and only while the strip is
        // within a viewport of being in play. This rides on the rect we already
        // had to read, so watching for it is free.
        var near = rect.bottom > -vh && rect.top < vh * 2;
        if (near !== live) {
            live = near;
            section.classList.toggle('is-live', near);
        }

        if (near) {
            var travel = track.scrollWidth - section.clientWidth;

            if (travel > 24) {
                // The frame is shorter than the viewport, so it parks at the
                // middle rather than the top. `passed` is how far past that
                // resting line the section has pushed; clamped to [0, travel]
                // it is both the distance the frame must be nudged down to stay
                // put and the distance the image must slide left, which keeps
                // the two in lockstep.
                var rest = (vh - viewport.offsetHeight) / 2;
                var passed = rest - rect.top;
                var offset = passed < 0 ? 0 : (passed > travel ? travel : passed);
                viewport.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
                track.style.transform = 'translate3d(' + (-offset).toFixed(1) + 'px,0,0)';
            } else {
                viewport.style.transform = '';
                track.style.transform = '';
            }
        }

        raf = requestAnimationFrame(frame);
    }

    // Callback order matters here in a way it did not when this only panned an
    // image. Locomotive writes each section's transform inside its own rAF; the
    // rect we read is only current if our callback runs after that write. Being
    // one frame stale would show up as the pinned frame sliding by a frame's
    // worth of scroll and snapping back — invisible on a pan, obvious on a pin.
    // rAF callbacks fire in registration order and a self-re-registering loop
    // keeps its slot, so joining a frame late (once Locomotive's loop is
    // already turning) puts us behind it and keeps us there.
    function arm() {
        if (running) return;
        var track = document.querySelector('.h-strip-track');
        if (!track) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (document.documentElement.classList.contains('touch-device')) return;
        running = true;
        raf = requestAnimationFrame(function () {
            raf = requestAnimationFrame(frame);
        });
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
        // Barba swaps in a fresh section that carries no class, so a stale
        // `live` would make the next frame think it had already applied it.
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
