# Visual verification recipe

How to actually check a rendered/interactive change in this repo. Two things that look
like the obvious approach both turned out to be unreliable in this environment — see
CLAUDE.md's two gotchas on headless-Chrome viewport testing and `<dialog>` automation —
so this is the recipe that's actually been verified to work, built from what succeeded
across many rounds of trial and error. Reach for this instead of reinventing it.

## Why not simpler approaches

- `google-chrome --headless --window-size=W,H --screenshot=out.png <url>` produces an
  image that's genuinely `W×H` pixels, but the page can be laid out at a *different*
  internal width and scaled/cropped into that image — so the screenshot can look
  plausible while measuring the wrong thing entirely. Don't trust it below typical
  desktop widths.
- Simulating a click on something inside a `<dialog>` opened via `.showModal()` — via
  `Runtime.evaluate`-driven `.click()`, or coordinate-based `Input.dispatchMouseEvent` —
  has silently done nothing (no console error, no state change) across multiple fresh
  browser profiles, while the same interaction works fine for a real person clicking a
  real browser. If an automated test of `<dialog>` content fails, verify manually before
  concluding the app is broken — don't spend time debugging the app first.

## The reliable path: drive headless Chrome directly over CDP

**1. Build and serve the production build** — not `npm run dev`. Verifying the actual
built output matters whenever the service worker, caching, or anything build-specific is
in play (which is often, since `vite-plugin-pwa` only activates in production):

```bash
npm run build
nohup npm run preview -- --port 5173 > /tmp/preview.log 2>&1 &
disown
sleep 2
```

**2. Launch headless Chrome with remote debugging, on a fresh scratch profile** — never
reuse an old profile directory. A previously-registered service worker can silently keep
serving a stale JS bundle across rebuilds even on a fresh navigation, which looks
exactly like a real bug (this cost real debugging time before it was traced back to the
profile, not the app):

```bash
rm -rf /tmp/chrome-verify-profile
nohup google-chrome --headless --disable-gpu --no-sandbox \
  --user-data-dir=/tmp/chrome-verify-profile \
  --remote-debugging-port=9500 "about:blank" > /tmp/chrome-verify.log 2>&1 &
disown
sleep 2
```

**3. Get the websocket debugger URL:**

```bash
curl -s http://localhost:9500/json | node -e "
let data='';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
  const targets = JSON.parse(data);
  console.log(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
});
"
```

**4. Drive the page over that websocket.** Node has a global `WebSocket` (stable since
Node 22 — this repo already requires Node 19+ for `crypto.randomUUID()`, so this is a
strictly higher bar, not a new constraint). Always set `Emulation.setDeviceMetricsOverride`
with `mobile: true` for any narrow-viewport check — this is what actually fixes gotcha
#1 above; the command-line `--window-size` flag alone is not enough:

```js
const ws = new WebSocket('ws://localhost:9500/devtools/page/<id-from-step-3>');
let id = 1;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve) => {
    const msgId = id++;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
});
ws.addEventListener('open', async () => {
  await send('Page.enable', {});
  await send('Emulation.setDeviceMetricsOverride', {
    width: 400, height: 900, deviceScaleFactor: 1, mobile: true,
  });
  await send('Page.navigate', { url: 'http://localhost:5173/europapark-2024' });
  await new Promise((r) => setTimeout(r, 1500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('/tmp/screenshot.png', Buffer.from(shot.data, 'base64'));
  process.exit(0);
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 10000);
```

For desktop widths, `mobile: false` is fine and the plain command-line `--screenshot`
flag has also worked reliably in practice — the unreliability is specifically a narrow-
viewport problem, not a general one.

To check real functional behavior rather than just appearance, use `Runtime.evaluate`
to inspect the DOM/state directly (e.g. `document.querySelector(...).textContent`,
`localStorage.getItem(...)`) rather than trying to eyeball a screenshot — this is how
the offline-caching work in `docs/plan.md` was actually confirmed end-to-end (registered
the service worker, went genuinely offline via `Network.emulateNetworkConditions`
`{offline: true}`, hard-reloaded, checked the rendered content programmatically).

## Cleanup

Always kill the specific PIDs this session started, found via `ps aux | grep <port>`,
never a broad pattern like `pkill -f google-chrome` — the user's real, long-running
browser session is also just a `chrome` process, and a broad pattern can match it. Then
remove the scratch profile dir and log files:

```bash
kill <preview-pid> <preview-node-pid> <chrome-pid> 2>/dev/null
rm -rf /tmp/chrome-verify-profile /tmp/preview.log /tmp/chrome-verify.log
```
