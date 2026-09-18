const { cookies, verifySession, setCors } = require("./_auth");

module.exports = (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const session = verifySession(cookies(req)["__Host-early_session"]);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.status(200).json({ authenticated: true, username: session.sub });
};
