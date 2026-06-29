// Netlify Function. Deployed automatically from netlify/functions/.
// Keeps the Pinata JWT server-side — the browser only ever talks to this endpoint.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const JWT = process.env.PINATA_JWT;
  if (!JWT) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server is missing PINATA_JWT." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) }; }

  try {
    if (body.action === "uploadMetadata") {
      const cid = await pinJSON(JWT, body.metadata, body.name);
      return { statusCode: 200, body: JSON.stringify({ cid }) };
    }
    if (body.action === "uploadImage") {
      const cid = await pinImage(JWT, body);
      return { statusCode: 200, body: JSON.stringify({ cid }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: "Unknown action." }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Upload failed." }) };
  }
};

async function pinJSON(jwt, metadata, name) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ pinataContent: metadata, pinataMetadata: { name: name || "metadata.json" } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.reason || data?.error || "Pinata metadata upload failed.");
  return data.IpfsHash;
}

async function pinImage(jwt, { dataUrl, imageUrl, filename }) {
  let buffer, contentType = "application/octet-stream";
  if (dataUrl) {
    const m = /^data:(.+);base64,(.*)$/.exec(dataUrl);
    if (!m) throw new Error("Invalid data URL.");
    contentType = m[1];
    buffer = Buffer.from(m[2], "base64");
  } else if (imageUrl) {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error("Could not fetch the source image.");
    contentType = r.headers.get("content-type") || contentType;
    buffer = Buffer.from(await r.arrayBuffer());
  } else {
    throw new Error("Provide either dataUrl or imageUrl.");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename || "image");
  form.append("pinataMetadata", JSON.stringify({ name: filename || "puzzle-image" }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.reason || data?.error || "Pinata image upload failed.");
  return data.IpfsHash;
}
