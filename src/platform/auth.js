/**
 * src/platform/auth.js
 *
 * SIWE-style wallet authentication abstracted over both platforms.
 * The rest of the app calls signInWithPlatformWallet() and never worries
 * about which wallet is doing the signing.
 */

import { isFarcaster } from "./detect.js";
import { connectBrowserWallet, browserSign } from "./browserWallet.js";
import { connectFarcasterWallet, farcasterSign } from "./farcasterWallet.js";
import { verifyMessage } from "ethers";

// ─── SIWE helpers ────────────────────────────────────────────────────────────

function buildSiweMessage(address, nonce) {
  return (
    `${window.location.host} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `Sign in to PuzzleChain to verify you own this wallet. ` +
    `This request will not trigger a blockchain transaction or cost any gas.\n\n` +
    `URI: ${window.location.origin}\n` +
    `Version: 1\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${new Date().toISOString()}`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Connect the platform wallet and return the verified address.
 * On success also verifies signature so the caller can trust the address.
 *
 * @returns {Promise<string>} verified lowercase address
 */
export async function connectPlatformWallet() {
  if (isFarcaster()) {
    return connectFarcasterWallet();
  }
  return connectBrowserWallet();
}

/**
 * Full SIWE sign-in: connect wallet → build message → sign → verify.
 *
 * @returns {Promise<string>} verified lowercase address
 */
export async function signInWithPlatformWallet() {
  const address = await connectPlatformWallet();
  const addrLower = address.toLowerCase();
  const nonce = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const message = buildSiweMessage(address, nonce);

  let signature;
  if (isFarcaster()) {
    signature = await farcasterSign(message, address);
  } else {
    signature = await browserSign(message, address);
  }

  let recovered = null;
  try { recovered = verifyMessage(message, signature); } catch { recovered = null; }
  if (!recovered || recovered.toLowerCase() !== addrLower) {
    throw new Error("Wallet signature could not be verified. Please try again.");
  }

  return addrLower;
}
