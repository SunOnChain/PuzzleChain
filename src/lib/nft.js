import { BrowserProvider, Contract } from "ethers";
import { PUZZLE_ACHIEVEMENT_ABI } from "../contract/abi.js";
import { uploadImageToPinata, uploadMetadataToPinata } from "./pinata.js";
import { platform } from "../platform/index.js";

const NFT_CONTRACT_ADDRESS = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "";

/// True once the deployed contract's address has been configured via env var.
export function isMintConfigured() {
  return !!NFT_CONTRACT_ADDRESS;
}

const IMAGE_CID_CACHE_KEY = "puzzleImageCids";

function getCachedImageCid(puzzleId) {
  try { return (JSON.parse(localStorage.getItem(IMAGE_CID_CACHE_KEY)) || {})[puzzleId] || null; }
  catch { return null; }
}
function setCachedImageCid(puzzleId, cid) {
  try {
    const map = JSON.parse(localStorage.getItem(IMAGE_CID_CACHE_KEY)) || {};
    map[puzzleId] = cid;
    localStorage.setItem(IMAGE_CID_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

async function getOrUploadImageCid(puzzle) {
  const cached = getCachedImageCid(puzzle.id);
  if (cached) return cached;
  const isDataUrl = typeof puzzle.url === "string" && puzzle.url.startsWith("data:");
  const cid = await uploadImageToPinata({
    dataUrl:  isDataUrl ? puzzle.url  : undefined,
    imageUrl: isDataUrl ? undefined   : puzzle.url,
    filename: `puzzle-${puzzle.id}.jpg`,
  });
  setCachedImageCid(puzzle.id, cid);
  return cid;
}

function difficultyForPieces(n) {
  if (n <= 36)  return "Easy";
  if (n <= 100) return "Medium";
  if (n <= 196) return "Hard";
  return "Expert";
}

export function buildAchievementMetadata({ puzzle, pieces, secs, address, imageCid }) {
  const category  = puzzle.tags?.[0]
    ? puzzle.tags[0][0].toUpperCase() + puzzle.tags[0].slice(1)
    : "General";
  const difficulty = difficultyForPieces(pieces);
  const mintedAt   = Date.now();

  return {
    name:        `${puzzle.title} — ${pieces}pc Achievement`,
    description: `Awarded for completing "${puzzle.title}" (${pieces} pieces) on PuzzleChain.`,
    image:       `ipfs://${imageCid}`,
    attributes: [
      { trait_type: "Puzzle Name",      value: puzzle.title },
      { trait_type: "Puzzle ID",        value: String(puzzle.id) },
      { trait_type: "Category",         value: category },
      { trait_type: "Difficulty",       value: difficulty },
      { trait_type: "Piece Count",      value: pieces },
      { trait_type: "Solve Time (s)",   value: secs },
      { trait_type: "Solver",           value: address },
      { trait_type: "Minted At",        value: new Date(mintedAt).toISOString() },
    ],
    puzzleId:          puzzle.id,
    puzzleName:        puzzle.title,
    category,
    difficulty,
    pieceCount:        pieces,
    solveTimeSeconds:  secs,
    solver:            address,
    mintTimestamp:     mintedAt,
  };
}

/**
 * Full mint flow.
 * Uses platform.getProvider() so it works in both MetaMask and Farcaster.
 */
export async function mintAchievement({ puzzle, pieces, secs, address }) {
  if (!isMintConfigured()) throw new Error("NFT minting isn't configured yet (no contract address set).");

  // Use the platform provider — works for both browser wallet and Farcaster embedded wallet.
  const rawProvider = platform.getProvider();
  if (!rawProvider) throw new Error("No wallet found. Connect your wallet to mint.");

  const imageCid    = await getOrUploadImageCid(puzzle);
  const metadata    = buildAchievementMetadata({ puzzle, pieces, secs, address, imageCid });
  const metadataCid = await uploadMetadataToPinata(metadata, `${puzzle.title} ${pieces}pc achievement`);
  const tokenURI    = `ipfs://${metadataCid}`;

  const provider = new BrowserProvider(rawProvider);
  const signer   = await provider.getSigner();
  const contract = new Contract(NFT_CONTRACT_ADDRESS, PUZZLE_ACHIEVEMENT_ABI, signer);

  const tx      = await contract.safeMint(address, tokenURI);
  const receipt = await tx.wait();

  let tokenId = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "AchievementMinted") { tokenId = parsed.args.tokenId.toString(); break; }
    } catch { /* not one of our events */ }
  }

  return { txHash: receipt.hash, tokenId, tokenURI, imageCid, metadataCid };
}
