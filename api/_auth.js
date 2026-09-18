const crypto = require("crypto");

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signSession(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

function verifySession(token) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest("base64url");
  const actual = Buffer.from(parts[2]);
  const wanted = Buffer.from(expected);
  if (
    actual.length !== wanted.length ||
    !crypto.timingSafeEqual(actual, wanted)
  )
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch (_) {
    return null;
  }
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          part.slice(0, index).trim(),
          decodeURIComponent(part.slice(index + 1).trim()),
        ];
      }),
  );
}

function setCors(res) {
  const origin = process.env.FRONTEND_ORIGIN?.replace(/\/$/, "");
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function clearCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "__Host-early_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None",
  );
}

module.exports = {
  base64url,
  signSession,
  verifySession,
  cookies,
  setCors,
  clearCookie,
};
