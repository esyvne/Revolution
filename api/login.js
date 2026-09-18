const crypto = require("crypto");
const { signSession, setCors, clearCookie } = require("./_auth");

function verifyPassword(password, stored) {
  const [salt, encoded] = String(stored || "").split(":");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

module.exports = (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "method_not_allowed" });
  const { username, password } = req.body || {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 128 ||
    password.length > 512
  ) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const valid =
    username === process.env.AUTH_USERNAME &&
    verifyPassword(password, process.env.AUTH_PASSWORD_HASH || "");
  if (!valid) {
    clearCookie(res);
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const now = Math.floor(Date.now() / 1000);
  const token = signSession({
    sub: username,
    iat: now,
    exp: now + 60 * 60 * 8,
  });
  res.setHeader(
    "Set-Cookie",
    `__Host-early_session=${encodeURIComponent(token)}; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=None`,
  );
  return res.status(200).json({ ok: true });
};
