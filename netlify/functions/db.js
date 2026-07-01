// Netlify Function — proxies DB operations to Supabase.
// The SUPABASE_SERVICE_KEY never leaves this function.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const URL  = process.env.SUPABASE_URL;
  const KEY  = process.env.SUPABASE_SERVICE_KEY;

  if (!URL || !KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: "Database not configured: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  try {
    const result = await dispatch(URL, KEY, body);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "DB error" }) };
  }
};

// ─── Supabase REST helpers ─────────────────────────────────────
function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra,
  };
}

async function sbGet(url, key, table, params = "") {
  const r = await fetch(`${url}/rest/v1/${table}?${params}`, { headers: headers(key) });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

async function sbPost(url, key, table, data) {
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

async function sbPatch(url, key, table, filter, data) {
  const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: headers(key),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

async function sbDelete(url, key, table, filter) {
  const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: headers(key),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
}

// ─── Action dispatcher ────────────────────────────────────────
async function dispatch(URL, KEY, { action, ...p }) {
  switch (action) {

    // ── Community puzzles ─────────────────────────────────────
    case "getCommunityPuzzles": {
      const rows = await sbGet(URL, KEY, "community_puzzles",
        "is_hidden=eq.false&order=created_at.desc&select=*");
      return { rows };
    }

    case "addCommunityPuzzle": {
      const { puzzle } = p;
      const rows = await sbPost(URL, KEY, "community_puzzles", [{
        id:           puzzle.id,
        url:          puzzle.url,
        title:        puzzle.title,
        description:  puzzle.desc || "",
        tags:         puzzle.tags || [],
        author:       puzzle.author || "",
        author_name:  puzzle.authorName || "",
        created_at:   puzzle.createdAt || Date.now(),
        is_hidden:    false,
      }]);
      return { row: rows[0] || null };
    }

    case "hideCommunityPuzzle": {
      await sbPatch(URL, KEY, "community_puzzles", `id=eq.${p.id}`, { is_hidden: true });
      return { ok: true };
    }

    case "deleteCommunityPuzzle": {
      await sbDelete(URL, KEY, "community_puzzles", `id=eq.${p.id}`);
      return { ok: true };
    }

    // ── Solve history ─────────────────────────────────────────
    case "addSolve": {
      const { entry } = p;
      const rows = await sbPost(URL, KEY, "solve_history", [{
        address:      (entry.address || "").toLowerCase(),
        puzzle_id:    entry.puzzleId,
        puzzle_title: entry.puzzleTitle || "",
        pieces:       entry.pieces,
        secs:         entry.secs,
        on_chain:     false,
        ts:           entry.ts || Date.now(),
      }]);
      return { row: rows[0] || null };
    }

    case "getUserHistory": {
      const rows = await sbGet(URL, KEY, "solve_history",
        `address=eq.${encodeURIComponent((p.address||"").toLowerCase())}&order=ts.desc&select=*`);
      return { rows };
    }

    case "markSolveOnChain": {
      const { id, onChainData } = p;
      await sbPatch(URL, KEY, "solve_history", `id=eq.${id}`, {
        on_chain:  true,
        tx_hash:   onChainData.txHash || null,
        token_id:  onChainData.tokenId != null ? String(onChainData.tokenId) : null,
        token_uri: onChainData.tokenURI || null,
        minted_at: onChainData.mintedAt || Date.now(),
      });
      return { ok: true };
    }

    // ── Leaderboard ───────────────────────────────────────────
    case "addLeaderboardEntry": {
      const { entry } = p;
      await sbPost(URL, KEY, "leaderboard", [{
        puzzle_id:    entry.puzzleId,
        puzzle_title: entry.puzzleTitle || "",
        pieces:       entry.pieces,
        secs:         entry.secs,
        username:     entry.username || "Guest",
        address:      (entry.address || "").toLowerCase(),
        tx_hash:      entry.txHash || null,
        token_id:     entry.tokenId != null ? String(entry.tokenId) : null,
        token_uri:    entry.tokenURI || null,
        minted_at:    entry.mintedAt || Date.now(),
        ts:           entry.ts || Date.now(),
      }]);
      return { ok: true };
    }

    case "getPuzzleLeaderboard": {
      const rows = await sbGet(URL, KEY, "leaderboard",
        `puzzle_id=eq.${p.puzzleId}&pieces=eq.${p.pieces}&order=secs.asc,minted_at.asc&select=*`);
      return { rows };
    }

    // ── Solve counts (how many times each puzzle has been solved) ─
    case "getPuzzleSolveCounts": {
      // One row per (puzzle_id, count) — we aggregate client-side since
      // Supabase's free-tier REST API doesn't expose GROUP BY directly.
      const rows = await sbGet(URL, KEY, "solve_history", "select=puzzle_id");
      const counts = {};
      for (const r of rows) {
        counts[r.puzzle_id] = (counts[r.puzzle_id] || 0) + 1;
      }
      return { counts };
    }

    // ── Upsert actions used by the one-time localStorage migration ──
    // ON CONFLICT DO NOTHING means re-running the migration is always safe.

    case "upsertCommunityPuzzle": {
      const { puzzle } = p;
      // community_puzzles.id is the primary key — conflict = already migrated.
      const r = await fetch(`${URL}/rest/v1/community_puzzles`, {
        method: "POST",
        headers: { ...headers(KEY), Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify([{
          id: puzzle.id, url: puzzle.url, title: puzzle.title,
          description: puzzle.desc || "", tags: puzzle.tags || [],
          author: puzzle.author || "", author_name: puzzle.authorName || "",
          created_at: puzzle.createdAt || puzzle.id, is_hidden: false,
        }]),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      return { ok: true };
    }

    case "upsertSolve": {
      const { entry } = p;
      // solve_history has no natural unique key from localStorage, so we use
      // (address, puzzle_id, secs, ts) as a composite duplicate guard.
      // We add a migration_key column check via a unique index in the migration
      // helper below, but for now we use ignore-duplicates on a synthetic key.
      // The simplest safe approach: check if an identical row exists first.
      const existing = await sbGet(URL, KEY, "solve_history",
        `address=eq.${encodeURIComponent(entry.address)}&puzzle_id=eq.${entry.puzzleId}&secs=eq.${entry.secs}&ts=eq.${entry.ts}&select=id`);
      if (existing.length > 0) return { ok: true }; // already migrated
      const rows = await sbPost(URL, KEY, "solve_history", [{
        address:      entry.address,
        puzzle_id:    entry.puzzleId,
        puzzle_title: entry.puzzleTitle || "",
        pieces:       entry.pieces,
        secs:         entry.secs,
        on_chain:     !!entry.onChain,
        tx_hash:      entry.txHash || null,
        token_id:     entry.tokenId || null,
        token_uri:    entry.tokenURI || null,
        minted_at:    entry.mintedAt || null,
        ts:           entry.ts,
      }]);
      return { row: rows[0] || null };
    }

    case "upsertLeaderboardEntry": {
      const { entry } = p;
      // Deduplicate leaderboard on (address, puzzle_id, pieces, tx_hash).
      if (entry.txHash) {
        const existing = await sbGet(URL, KEY, "leaderboard",
          `tx_hash=eq.${encodeURIComponent(entry.txHash)}&select=id`);
        if (existing.length > 0) return { ok: true };
      }
      await sbPost(URL, KEY, "leaderboard", [{
        puzzle_id:    entry.puzzleId,
        puzzle_title: entry.puzzleTitle || "",
        pieces:       entry.pieces,
        secs:         entry.secs,
        username:     entry.username || "Guest",
        address:      entry.address,
        tx_hash:      entry.txHash || null,
        token_id:     entry.tokenId || null,
        token_uri:    entry.tokenURI || null,
        minted_at:    entry.mintedAt || null,
        ts:           entry.ts,
      }]);
      return { ok: true };
    }

    case "ping":
      return { ok: true, ts: Date.now() };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
