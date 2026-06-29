# 🧩 PuzzleChain

Jigsaw puzzles meet Web3. Solve puzzles, record scores on Monad blockchain.

## Deploy in 5 minutes

### Option A — Netlify (easiest, free)
1. Go to https://netlify.com → Sign up free
2. Click "Add new site" → "Deploy manually"
3. Drag and drop the entire `puzzlechain` folder onto the page
4. Done! You get a live URL instantly.

### Option B — Vercel (also free)
1. Go to https://vercel.com → Sign up free
2. Click "Add New Project" → "Deploy from Git" OR use CLI:
   ```
   npm install -g vercel
   cd puzzlechain
   vercel
   ```

### Option C — Run locally
```bash
cd puzzlechain
npm install
npm run dev
```
Then open http://localhost:5173

## Sign In
- No email, password, or username needed — click "Connect Wallet", approve the connection, then sign the verification message in your wallet.
- That's your account: first time connecting that wallet creates your profile automatically, every time after that just signs you back in.
- Set a display name, a unique username, and a bio anytime from My Profile.

## Admin Access
- Open `src/App.jsx` and add your wallet address (lowercase) to the `ADMIN_WALLETS` array near the top of the file.
- Reconnect that wallet and you'll see the Admin Panel in your account menu.

## Wallet
- Requires MetaMask (or another EVM wallet) browser extension.
- Works on Monad Testnet and Mainnet.
