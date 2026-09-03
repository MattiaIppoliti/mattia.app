/**
 * Restart a looping demo video from the top each time it comes into view.
 *
 * Chrome suspends a muted autoplaying video while it is off screen and resumes
 * it where it left off, so a visitor who scrolls down can arrive mid loop, or
 * during the pause the clip holds on its last frame, and read the whole thing
 * as a still image. Seeking back to zero on entry means the animation always
 * plays from the first message.
 */
(function () {
    var observer = null;

    function watch() {
        var videos = document.querySelectorAll('[data-replay-in-view] video');
        if (!videos.length) return;

        if (!('IntersectionObserver' in window)) return;

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var video = entry.target;
                if (entry.isIntersecting) {
                    // A seek on a paused video is cheap; on a playing one it
                    // rewinds without a flash because the frame is decoded.
                    try { video.currentTime = 0; } catch (e) {}
                    var played = video.play();
                    if (played && played.catch) played.catch(function () {});
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.35 });

        Array.prototype.forEach.call(videos, function (video) {
            observer.observe(video);
        });
    }

    function stop() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watch);
    } else {
        watch();
    }

    // Barba swaps the container, so the old targets go with it.
    if (typeof barba !== 'undefined' && barba.hooks) {
        barba.hooks.beforeLeave(stop);
        barba.hooks.after(watch);
    }
})();
