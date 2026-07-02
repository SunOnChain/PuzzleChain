# Farcaster Mini App Setup

PuzzleChain runs as both a normal website and a Farcaster Mini App from the same codebase. This guide walks through publishing it as a Mini App.

---

## How it works

| Layer | File | Role |
|---|---|---|
| Detection + init | `src/lib/farcaster.js` | Calls `isInMiniApp()`, bridges wallet, calls `ready()`, caches context |
| React hook | `src/hooks/useFarcaster.js` | Exposes `isInFarcaster`, `context`, `user`, `fid`, `actions` to any component |
| Manifest | `public/.well-known/farcaster.json` | Served statically; identifies the app to Farcaster clients |
| Embed meta | `index.html` | `fc:miniapp` / `fc:frame` tags — shown when the URL is pasted in a cast |
| SDK init | `src/App.jsx` (one `useEffect`) | Calls `initFarcaster()` once on mount |

In a normal browser: `isInMiniApp()` resolves to `false` in ≤ 100 ms. `initFarcaster` returns `null` and exits. **Nothing else changes.**

In Farcaster: the SDK bridges `sdk.wallet.getEthereumProvider()` → `window.ethereum` so the existing `connectWallet()` / SIWE auth works without modification, then calls `sdk.actions.ready()` to reveal the app.

---

## Step 1 — Replace placeholder values in `index.html`

Open `index.html` and replace every `REPLACE_WITH_*` token:

| Token | Replace with |
|---|---|
| `REPLACE_WITH_HTTPS_URL_TO_OG_IMAGE` | A 3:2 ratio image URL (e.g. `https://yourdomain.com/og.png`) |
| `REPLACE_WITH_YOUR_DEPLOYED_URL` | Your live URL (e.g. `https://puzzlechain.xyz`) |
| `REPLACE_WITH_HTTPS_URL_TO_SPLASH_IMAGE` | A square icon ≥ 200 × 200 px |

---

## Step 2 — Replace placeholder values in `public/.well-known/farcaster.json`

1. Enable **Developer Mode** in Farcaster: [farcaster.xyz/~/settings/developer-tools](https://farcaster.xyz/~/settings/developer-tools)
2. Open **Developer Tools → Create Manifest**.
3. Enter your domain (e.g. `puzzlechain.xyz`).
4. Sign with your custody wallet — this generates the `accountAssociation` block.
5. Paste the generated values into `public/.well-known/farcaster.json`.
6. Replace the remaining `REPLACE_WITH_*` values with real image URLs.
7. **Remove the `_comment` keys** before deploying — they are for developer reference only.

> **The manifest must be valid JSON** (no comments) when served in production.
> The `_comment` keys are harmless but unnecessary.

### Verify the manifest is reachable

After deploying:
```
curl https://yourdomain.com/.well-known/farcaster.json
```
Should return the JSON with status 200.

---

## Step 3 — Preview inside Farcaster

1. In Developer Tools, open **Preview Mini App**.
2. Enter your deployed URL.
3. Warpcast opens your app in a mini app frame.
4. You should see the splash screen dismiss (that's `sdk.actions.ready()` working).
5. Open DevTools → Console. You should see:
   - `[Farcaster] isInMiniApp = true`
   - The Farcaster context logged

---

## Step 4 — Publish

Follow the official guide: [miniapps.farcaster.xyz/docs/guides/publishing](https://miniapps.farcaster.xyz/docs/guides/publishing)

---

## Adding Farcaster features later

All future Farcaster-specific features should be added to `src/lib/farcaster.js` only. The stubs in `farcasterActions` have the correct signatures already:

### Share achievement as a Cast

```js
// In src/lib/farcaster.js, inside shareAchievement():
await sdk.actions.composeCast({
  text: `🧩 I solved "${opts.puzzleTitle}" in ${fmt(opts.secs)} on PuzzleChain!`,
  embeds: [`${window.location.origin}?puzzle=${opts.puzzleId}`],
});
```

Then in PuzzleGame's completion bar:
```js
import { useFarcaster } from "./hooks/useFarcaster.js";
const { actions } = useFarcaster();
// After mint:
await actions.shareAchievement({ puzzleTitle, secs, tokenId, puzzleId });
```

### Open a Farcaster user profile

```js
// In openUserProfile():
await sdk.actions.openUrl(`https://warpcast.com/~/profiles/${fid}`);
```

### Send a notification

```js
// In sendNotification():
const { notificationDetails } = _context.client;
if (!notificationDetails) return; // user hasn't added the app yet
await fetch(notificationDetails.url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    notificationId: crypto.randomUUID(),
    title: opts.title,
    body: opts.body,
    targetUrl: opts.targetUrl,
    tokens: [notificationDetails.token],
  }),
});
```

### Subscribe to host events

```js
// In onEvent():
sdk.on(event, handler);
return () => sdk.off(event, handler);
```

---

## Environment variables

No new environment variables are required for basic Farcaster support. The SDK is a client-side package; all secrets (Supabase, Pinata, NFT contract) remain server-side as before.

---

## Testing locally

Farcaster Mini Apps must be served over HTTPS with a real domain for the postMessage handshake to work. Use a tunnel tool:

```bash
npx localtunnel --port 5173
# or
npx cloudflared tunnel --url http://localhost:5173
```

Then paste the HTTPS URL into Farcaster Developer Tools → Preview.
