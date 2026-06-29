// Talks only to our own serverless function — the Pinata JWT lives server-side
// (see netlify/functions/pinata-upload.js and api/pinata-upload.js) and is never
// sent to or readable by the browser.
async function callUploadFn(payload) {
  const res = await fetch("/api/pinata-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data;
}

/// Upload an image to IPFS via Pinata. Pass either `dataUrl` (base64, for
/// user-uploaded puzzle images) or `imageUrl` (for the built-in seed puzzles,
/// which are plain https URLs) — the server fetches/decodes and pins it.
/// Returns the resulting IPFS CID.
export async function uploadImageToPinata({ dataUrl, imageUrl, filename }) {
  const { cid } = await callUploadFn({ action: "uploadImage", dataUrl, imageUrl, filename });
  return cid;
}

/// Upload an NFT metadata JSON object to IPFS via Pinata. Returns the CID.
export async function uploadMetadataToPinata(metadata, name) {
  const { cid } = await callUploadFn({ action: "uploadMetadata", metadata, name });
  return cid;
}
