const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const SESSION_COOKIE_NAME = "bus_tracker_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessionStore = new Map();

function requireJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Missing required env var: JWT_SECRET");
  return s;
}

function signToken(payload) {
  const secret = requireJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const trimmed = part.trim();
    if (!trimmed) return acc;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return acc;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  parts.push(`Path=${opts.path || "/"}`);
  return parts.join("; ");
}

function getSessionId(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

function createSession(res, user) {
  const sid = crypto.randomBytes(24).toString("hex");
  sessionStore.set(sid, {
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, sid, {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      path: "/",
    })
  );

  return sid;
}

function destroySession(req, res) {
  const sid = getSessionId(req);
  if (sid) sessionStore.delete(sid);

  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    })
  );
}

function getSessionUser(req) {
  const sid = getSessionId(req);
  if (!sid) return null;

  const session = sessionStore.get(sid);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(sid);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session.user;
}

function attachSessionUser(req) {
  const user = getSessionUser(req);
  if (user) req.user = user;
  return user;
}

function authMiddleware(req, res, next) {
  const sessionUser = attachSessionUser(req);
  if (sessionUser) return next();

  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const secret = requireJwtSecret();
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = {
  SESSION_COOKIE_NAME,
  attachSessionUser,
  authMiddleware,
  createSession,
  destroySession,
  signToken,
};

