const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const PassengerEvent = require("../models/PassengerEvent");
const LiveLocation = require("../models/LiveLocation");
const BusStop = require("../models/BusStop");
const { signToken, authMiddleware } = require("../auth");

const router = express.Router();

router.get("/health", (req, res) => res.json({ ok: true }));

router.get("/stops", async (req, res) => {
  const routeId = (req.query.routeId || "").trim();

  const query = {};
  if (routeId) query.routeId = routeId;

  const docs = await BusStop.find(query).lean();
  const names = docs
    .map((d) => (d.stop_name || "").trim())
    .filter(Boolean);

  const unique = [...new Set(names)];
  unique.sort((a, b) => a.localeCompare(b));
  res.json({ stops: unique });
});

router.get("/route-stops", async (req, res) => {
  const routeId = (req.query.routeId || "").trim();
  const query = {};
  if (routeId) query.routeId = routeId;

  const docs = await BusStop.find(query).lean();
  const items = docs
    .map((d) => ({
      name: (d.stop_name || "").trim(),
      order: typeof d.order === "number" ? d.order : null,
      raw: d,
    }))
    .filter((x) => x.name);

  items.sort((a, b) => {
    if (a.order == null && b.order == null) return a.name.localeCompare(b.name);
    if (a.order == null) return 1;
    if (b.order == null) return -1;
    return a.order - b.order;
  });

  res.json({ stops: items.map(({ name, order }) => ({ name, order })) });
});

router.get("/passenger-count", async (req, res) => {
  const routeId = (req.query.routeId || "").trim();
  const busNumber = (req.query.busNumber || "").trim();
  const maxAgeMsRaw = (req.query.maxAgeMs || "").toString().trim();
  const maxAgeMs =
    maxAgeMsRaw && !Number.isNaN(Number(maxAgeMsRaw))
      ? Math.max(0, Number(maxAgeMsRaw))
      : 15000;

  async function findLatest(q) {
    return PassengerEvent.findOne(q).sort({ timestamp: -1, _id: -1 }).lean();
  }

  let doc = null;
  if (routeId && busNumber) {
    doc = await findLatest({ routeId, busNumber });
  }
  if (!doc && busNumber) {
    doc = await findLatest({ busNumber });
  }
  if (!doc && routeId) {
    doc = await findLatest({ routeId });
  }
  if (!doc) {
    doc = await findLatest({});
  }

  if (doc) {
    const ts = doc.timestamp || doc.updatedAt || null;
    const t = ts ? new Date(ts).getTime() : NaN;
    const isStale =
      Number.isFinite(t) && Number.isFinite(maxAgeMs) && maxAgeMs > 0
        ? Date.now() - t > maxAgeMs
        : false;
    if (isStale) {
      return res.json({ count: 0, source: "stale" });
    }
  }

  const count =
    doc && typeof doc.inside_total === "number"
      ? doc.inside_total
      : doc && typeof doc.in === "number"
        ? doc.in
        : doc && typeof doc.value === "number"
          ? doc.value
          : 0;

  res.json({ count, source: doc ? "db" : "none" });
});

router.get("/live-location", async (req, res) => {
  const routeId = (req.query.routeId || "").trim();
  const busNumber = (req.query.busNumber || "").trim();

  async function findLatest(q) {
    return LiveLocation.findOne(q).sort({ updatedAt: -1, timestamp: -1, _id: -1 }).lean();
  }

  let doc = null;
  if (routeId && busNumber) {
    doc = await findLatest({ routeId, busNumber });
  }
  if (!doc && busNumber) {
    doc = await findLatest({ busNumber });
  }
  if (!doc && routeId) {
    doc = await findLatest({ routeId });
  }
  if (!doc) {
    doc = await findLatest({});
  }

  if (!doc) return res.status(404).json({ message: "No live location found" });

  const lat =
    typeof doc.lat === "number"
      ? doc.lat
      : typeof doc.latitude === "number"
        ? doc.latitude
        : typeof doc.lattitude === "number"
          ? doc.lattitude
          : null;
  const lng =
    typeof doc.lng === "number"
      ? doc.lng
      : typeof doc.longitude === "number"
        ? doc.longitude
        : typeof doc.long === "number"
          ? doc.long
          : null;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(500).json({ message: "Invalid live location data" });
  }

  res.json({
    lat,
    lng,
    busNumber: doc.busNumber || null,
    routeId: doc.routeId || null,
    updatedAt: doc.updatedAt || doc.timestamp || null,
  });
});

router.post("/auth/register", async (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  if (password.length < 7) return res.status(400).json({ message: "Password must be at least 7 characters" });

  const exists = await User.findOne({ email }).lean();
  if (exists) return res.status(409).json({ message: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });

  const token = signToken({ id: user._id.toString(), email: user.email, name: user.name || "" });
  res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name || "" } });
});

router.post("/auth/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = signToken({ id: user._id.toString(), email: user.email, name: user.name || "" });
  res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name || "" } });
});

router.get("/me", authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
