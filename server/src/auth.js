const jwt = require("jsonwebtoken");

function requireJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Missing required env var: JWT_SECRET");
  return s;
}

function signToken(payload) {
  const secret = requireJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    const secret = requireJwtSecret();
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { signToken, authMiddleware };

