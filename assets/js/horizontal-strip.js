/**
 * Horizontal strip: a wide image pans sideways as the page scrolls down, so one
 * vertical scroll walks through the whole picture.
 *
 * Progress comes from the section's own viewport rect. Locomotive translates
 * each [data-scroll-section] individually, so the rect already reflects the
 * smoothed scroll position, and no ScrollTrigger pin is needed (pinning fights
 * Locomotive's transforms).
 */
(function () {
    var raf = 0;
    var running = false;

    function frame() {
        raf = 0;
        var track = document.querySelector('.h-strip-track');
        var section = track && track.closest('.h-strip');
        if (!track || !section) { running = false; return; }

        var viewportH = window.innerHeight;
        var travel = track.scrollWidth - section.clientWidth;

        if (travel > 24) {
            var rect = section.getBoundingClientRect();
            // 0 when the section's top edge reaches the bottom of the viewport,
            // 1 once its bottom edge has passed the top of the viewport.
            var progress = (viewportH - rect.top) / (rect.height + viewportH);
            progress = progress < 0 ? 0 : (progress > 1 ? 1 : progress);
            track.style.transform = 'translate3d(' + (-progress * travel).toFixed(1) + 'px, 0, 0)';
        } else {
            track.style.transform = '';
        }

        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (running) return;
        var track = document.querySelector('.h-strip-track');
        if (!track) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (document.documentElement.classList.contains('touch-device')) return;
        running = true;
        raf = requestAnimationFrame(frame);
    }

    function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        running = false;
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
