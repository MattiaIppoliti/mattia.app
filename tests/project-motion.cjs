// Serve the repository on port 4173, then run: node tests/project-motion.cjs
// Install the test dependency: npm install --no-save --package-lock=false playwright
// Requires Chrome. BASE_URL can point to a deployed site.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://localhost:4173';
const selectors = {
    ciele: '[data-replay-in-view] video',
    luiss: '.cs-browser-viewport',
};

async function navigate(page, path) {
    const destination = new URL(path, page.url()).href;
    const link = page.locator(`a[href="${path}"]:visible`).first();
    await link.evaluate(el => scroll.scrollTo(el, { duration: 0, disableLerp: true }));
    await page.waitForTimeout(700);
    await link.click();
    await page.waitForURL(destination);
    await page.waitForFunction(() => !document.documentElement.classList.contains('is-transitioning'));
    assert.equal(await page.evaluate(() => window.__motionDocument), true, 'Navigation must preserve the document');
    await page.waitForTimeout(1500);
}

async function checkMotion(page, name, checkLoop) {
    const target = page.locator(selectors[name]);
    await page.evaluate(selector => {
        scroll.scrollTo(document.querySelector(selector), { duration: 0, disableLerp: true });
    }, selectors[name]);
    await page.waitForTimeout(1200);
    const position = () => target.evaluate(el => el.tagName === 'VIDEO'
        ? el.currentTime
        : -new DOMMatrix(getComputedStyle(el.querySelector('.cs-browser-page')).transform).m42);
    const before = await position();
    await page.waitForTimeout(1200);
    assert.ok(await position() > before, `${name}: animation must advance while visible`);

    if (checkLoop && name === 'ciele') {
        await target.evaluate(video => {
            if (!video.loop || video.paused) throw new Error('Video must be playing on loop');
            video.currentTime = video.duration - 0.5;
        });
        await page.waitForFunction(() => {
            const video = document.querySelector('[data-replay-in-view] video');
            return !video.paused && video.currentTime > 0 && video.currentTime < 3;
        });
    } else if (checkLoop) {
        const travel = await target.evaluate(el => el.querySelector('.cs-browser-page').offsetHeight - el.offsetHeight);
        let reachedFooter = false;
        let returnedToTop = false;
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            const current = await position();
            if (current > travel * 0.9) reachedFooter = true;
            if (reachedFooter && current < travel * 0.1) {
                returnedToTop = true;
                break;
            }
            await page.waitForTimeout(100);
        }
        assert.ok(returnedToTop, 'LUISS must reach the footer and loop back to the top');
        await page.waitForTimeout(1200);
        const restarted = await position();
        await page.waitForTimeout(800);
        assert.ok(await position() > restarted, 'LUISS must resume after looping');
    }
}

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        for (const mobile of [true, false]) {
            const context = await browser.newContext({
                viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
                isMobile: mobile,
                hasTouch: mobile,
                reducedMotion: 'no-preference',
            });
            const page = await context.newPage();
            // Analytics do not participate in navigation or media playback.
            await page.route('**/_vercel/**', route => route.abort());
            for (const name of Object.keys(selectors)) {
                await page.goto(`${baseURL}/work/${name}/`, { waitUntil: 'load' });
                await page.waitForTimeout(2500);
                await checkMotion(page, name, false);
                console.log(`PASS ${mobile ? 'mobile' : 'desktop'} ${name}: direct load`);
            }
            await page.goto(baseURL, { waitUntil: 'load' });
            await page.waitForTimeout(2500);
            await page.evaluate(() => { window.__motionDocument = true; });
            for (const name of Object.keys(selectors)) {
                await navigate(page, `work/${name}/`);
                await checkMotion(page, name, true);
                console.log(`PASS ${mobile ? 'mobile' : 'desktop'} ${name}: navigation and loop`);
                await page.goBack();
                await page.waitForURL(`${baseURL}/`);
                await page.waitForFunction(() => !document.documentElement.classList.contains('is-transitioning'));
                await page.waitForTimeout(1500);
                await page.goForward();
                await page.waitForURL(`${baseURL}/work/${name}/`);
                await page.waitForFunction(() => !document.documentElement.classList.contains('is-transitioning'));
                await page.waitForTimeout(1500);
                await checkMotion(page, name, false);
                console.log(`PASS ${mobile ? 'mobile' : 'desktop'} ${name}: back/forward`);
                await page.goBack();
                await page.waitForURL(`${baseURL}/`);
                await page.waitForFunction(() => !document.documentElement.classList.contains('is-transitioning'));
                await page.waitForTimeout(1500);
            }
            await context.close();
        }
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
