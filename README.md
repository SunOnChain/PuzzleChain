# 🧩 PuzzleChain

Jigsaw puzzles meet Web3. Solve puzzles, mint achievement NFTs on Monad Mainnet.

## Deploy in 5 minutes

### Option A — Netlify (easiest, free)
1. Go to https://netlify.com → Sign up free
2. Click "Add new site" → "Deploy manually", or connect this repo via Git for automatic deploys (needed for the serverless function + env vars below).
3. In Site settings → Environment variables, add the variables listed in **Environment Variables** below.
4. Done! You get a live URL instantly.

### Option B — Vercel (also free)
1. Go to https://vercel.com → Sign up free
2. Click "Add New Project" → "Deploy from Git" OR use CLI:
   ```
   npm install -g vercel
   cd puzzlechain
   vercel
   ```
3. In Project Settings → Environment Variables, add the variables listed below.

### Option C — Run locally
```bash
cd puzzlechain
npm install
cp .env.example .env   # fill in your values
npm run dev
```
Then open http://localhost:5173. Note: the Pinata upload serverless function (`/api/pinata-upload`) only runs on Netlify/Vercel — `vite dev` alone won't serve it. Use `netlify dev` or `vercel dev` locally if you need to test minting end-to-end.

## Sign In
- No email, password, or username needed — click "Connect Wallet", approve the connection, then sign the verification message in your wallet.
- That's your account: first time connecting that wallet creates your profile automatically, every time after that just signs you back in.
- Set a display name, a unique username, and a bio anytime from My Profile.

## Wallet & Network
- Requires MetaMask (or another EVM wallet) browser extension.
- Runs on **Monad Mainnet** (chain id 143). The app will prompt to add/switch to it automatically when you connect.

---

## NFT Achievement System

Solving a puzzle on-chain mints you an ERC-721 "achievement" NFT for that puzzle + piece count. The flow is:

```
Puzzle solved → build metadata → upload metadata to IPFS (Pinata) → safeMint() →
wallet confirmation → transaction confirmation → store txHash/tokenId/tokenURI
```

This requires two things you set up once: a deployed contract, and a Pinata account.

### 1. Deploy the contract (Remix)

1. Open [Remix IDE](https://remix.ethereum.org).
2. Create a new file and paste in `contracts/PuzzleAchievement.sol`.
3. **Solidity Compiler** tab → set compiler version to `0.8.24+` → Compile. Remix will fetch OpenZeppelin Contracts v5.x automatically via its npm resolver.
4. **Deploy & Run Transactions** tab → Environment: "Injected Provider - MetaMask" → make sure MetaMask is on **Monad Mainnet** (chain id 143, RPC `https://rpc.monad.xyz`, add it via MetaMask's "Add network" if it's not there yet).
5. In the constructor field, enter the wallet address that should own the contract (`initialOwner`), then click **Deploy** and confirm in MetaMask.
6. Copy the deployed contract address.
7. (Optional) Copy the ABI from the Solidity Compiler tab's "ABI" button if you need the exact compiler output for marketplace verification — a working copy is already included at `contracts/PuzzleAchievement.abi.json`.

### 2. Set up Pinata

1. Sign up free at [pinata.cloud](https://pinata.cloud).
2. API Keys → New Key → enable pinning → copy the **JWT**.
3. Set it as `PINATA_JWT` in your hosting provider's environment variables (**server-side only** — see below). Never put it in a `VITE_` variable or commit it; the frontend never sees it.

### 3. Set your environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Where | Secret? | Purpose |
|---|---|---|---|
| `VITE_NFT_CONTRACT_ADDRESS` | Client | No | Your deployed contract's address |
| `VITE_ADMIN_WALLET` | Client | No | Wallet(s) that get Admin Panel access (comma-separated) |
| `VITE_MONAD_CHAIN_ID` / `VITE_MONAD_RPC_URL` / `VITE_MONAD_EXPLORER_URL` | Client | No | Optional overrides; sane Mainnet defaults are built in |
| `PINATA_JWT` | Server (Netlify/Vercel project settings) | **Yes** | Used only by the serverless upload function |

Until `VITE_NFT_CONTRACT_ADDRESS` is set, the mint button shows "NFT minting coming soon" and everything else in the app works as normal.

### How the pieces fit together

- `contracts/PuzzleAchievement.sol` — the ERC-721 contract (OpenZeppelin v5, `ERC721URIStorage` + `Ownable`). You deploy this manually via Remix; the app never deploys contracts itself.
- `contracts/PuzzleAchievement.abi.json` — full ABI for the deployed contract.
- `src/contract/abi.js` — the small subset of that ABI the frontend actually calls.
- `src/lib/nft.js` — builds NFT metadata and runs the full mint flow (upload → `safeMint` → wait for confirmation).
- `src/lib/pinata.js` — client helper that calls our *own* serverless endpoint, never Pinata directly.
- `netlify/functions/pinata-upload.js` and `api/pinata-upload.js` — the actual Pinata calls, using the secret `PINATA_JWT`. One or the other runs depending on whether you deploy to Netlify or Vercel; the frontend calls `/api/pinata-upload` either way (Netlify is configured to redirect that path to its function).

## Admin Access
- Set `VITE_ADMIN_WALLET` in your environment to your wallet address (comma-separate multiple addresses for more than one admin). No source code edits, no hardcoded addresses.
- Connect that wallet and you'll see the Admin Panel in your account menu. Admin status re-checks against this env var on every sign-in, so changing it takes effect the next time an admin connects.
