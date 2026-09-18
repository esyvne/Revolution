const { clearCookie, setCors } = require("./_auth");

module.exports = (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "method_not_allowed" });
  clearCookie(res);
  return res.status(200).json({ ok: true });
};
