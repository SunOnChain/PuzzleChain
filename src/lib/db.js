// All shared application data goes through this module.
// The browser NEVER calls Supabase directly — every request is proxied through
// our own serverless function (/api/db) so the service key stays server-side.
async function callDB(payload) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Database error");
  return data;
}

// ─── One-time migration from localStorage to Supabase ──────────
// Runs once per browser on startup. Reads whatever localStorage data still
// exists (from before the DB integration), pushes it to Supabase, then marks
// itself done so it never re-runs. Safe to call multiple times — the flag check
// makes it a no-op after the first successful run.
export async function migrateLocalStorageToDb() {
  const DONE_KEY = "pzc_db_migration_v1";
  try {
    if (localStorage.getItem(DONE_KEY)) return; // already migrated in this browser

    const promises = [];

    // ── Community puzzles ───────────────────────────────────────
    const userPuzzles = JSON.parse(localStorage.getItem("userPuzzles") || "[]");
    for (const p of userPuzzles) {
      promises.push(
        callDB({
          action: "upsertCommunityPuzzle",
          puzzle: {
            id: p.id, url: p.url, title: p.title,
            desc: p.desc || p.description || "",
            tags: p.tags || [],
            author: p.author || "",
            authorName: p.authorName || p.author_name || "",
            createdAt: p.createdAt || p.id,
          },
        }).catch(() => {})
      );
    }

    // ── Leaderboard + solve history ─────────────────────────────
    const lb = JSON.parse(localStorage.getItem("leaderboard") || "[]");
    for (const e of lb) {
      // Every entry goes into solve_history (the full history, minted or not).
      promises.push(
        callDB({
          action: "upsertSolve",
          entry: {
            address:      (e.address || "").toLowerCase(),
            puzzleId:     e.puzzleId,
            puzzleTitle:  e.puzzleTitle || "",
            pieces:       e.pieces,
            secs:         e.secs,
            onChain:      !!e.onChain,
            txHash:       e.txHash || null,
            tokenId:      e.tokenId != null ? String(e.tokenId) : null,
            tokenURI:     e.tokenURI || e.tokenUri || null,
            mintedAt:     e.mintedAt || null,
            ts:           e.ts || Date.now(),
          },
        }).catch(() => {})
      );

      // On-chain entries also go into the leaderboard table.
      if (e.onChain) {
        promises.push(
          callDB({
            action: "upsertLeaderboardEntry",
            entry: {
              puzzleId:    e.puzzleId,
              puzzleTitle: e.puzzleTitle || "",
              pieces:      e.pieces,
              secs:        e.secs,
              username:    e.username || "Guest",
              address:     (e.address || "").toLowerCase(),
              txHash:      e.txHash || null,
              tokenId:     e.tokenId != null ? String(e.tokenId) : null,
              tokenURI:    e.tokenURI || e.tokenUri || null,
              mintedAt:    e.mintedAt || null,
              ts:          e.ts || Date.now(),
            },
          }).catch(() => {})
        );
      }
    }

    await Promise.all(promises);
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    // Never crash the app over a migration failure — the data is still in localStorage.
  }
}

export const DB = {
  // ─── Community puzzles ──────────────────────────────────────
  async getCommunityPuzzles() {
    const { rows } = await callDB({ action: "getCommunityPuzzles" });
    return rows;
  },
  async addCommunityPuzzle(puzzle) {
    const { row } = await callDB({ action: "addCommunityPuzzle", puzzle });
    return row;
  },
  async hideCommunityPuzzle(id) {
    await callDB({ action: "hideCommunityPuzzle", id });
  },
  async deleteCommunityPuzzle(id) {
    await callDB({ action: "deleteCommunityPuzzle", id });
  },

  // ─── Solve history (per user, all solves) ───────────────────
  async addSolve(entry) {
    // Returns the new row (including its DB-generated UUID id).
    const { row } = await callDB({ action: "addSolve", entry });
    return row;
  },
  async getUserHistory(address) {
    const { rows } = await callDB({ action: "getUserHistory", address });
    return rows;
  },
  async markSolveOnChain(id, onChainData) {
    await callDB({ action: "markSolveOnChain", id, onChainData });
  },

  // ─── Leaderboard (on-chain only) ────────────────────────────
  async addLeaderboardEntry(entry) {
    await callDB({ action: "addLeaderboardEntry", entry });
  },
  async getPuzzleLeaderboard(puzzleId, pieces) {
    const { rows } = await callDB({ action: "getPuzzleLeaderboard", puzzleId, pieces });
    return rows;
  },

  // ─── Solve counts (for gallery "X solves" badge) ────────────
  async getPuzzleSolveCounts() {
    const { counts } = await callDB({ action: "getPuzzleSolveCounts" });
    return counts; // { [puzzleId]: number }
  },
};
