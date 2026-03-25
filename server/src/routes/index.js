const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const PassengerEvent = require("../models/PassengerEvent");
const LiveLocation = require("../models/LiveLocation");
const BusStop = require("../models/BusStop");
const { signToken, authMiddleware, createSession, destroySession } = require("../auth");

const router = express.Router();

function normalizeStopName(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  const aliases = {
    "surandai": "surandai bus stand",
    "alangulam": "alangulam bus stand",
    "bungalow surandai": "bungalow stop",
    "athiyoothu": "athiyuthu",
  };
  return aliases[normalized] || normalized;
}

function toStopDto(doc) {
  return {
    stop_id: doc.stop_id || null,
    route_id: doc.route_id || null,
    name: (doc.stop_name || "").trim(),
    arrival_time: doc.arrival_time || null,
    order: typeof doc.stop_order === "number" ? doc.stop_order : null,
  };
}

async function loadOrderedRouteStops(routeId) {
  const query = {};
  if (routeId) query.route_id = routeId;
  const docs = await BusStop.find(query).sort({ stop_order: 1, _id: 1 }).lean();
  return docs.map(toStopDto).filter((stop) => stop.name);
}

function getDbCollection(name) {
  return BusStop.collection && BusStop.collection.conn && BusStop.collection.conn.db
    ? BusStop.collection.conn.db.collection(name)
    : null;
}

async function loadRouteSearchMetadata(routeId) {
  const routesCollection = getDbCollection("routes");
  const busesCollection = getDbCollection("buses");

  const routeDoc = routesCollection
    ? await routesCollection.findOne({ route_id: routeId })
    : null;

  let buses = busesCollection
    ? await busesCollection.find({ route_id: routeId }).sort({ active: -1, bus_number: 1 }).toArray()
    : [];

  if (!buses.length && busesCollection && routesCollection) {
    const [activeBuses, routeCount] = await Promise.all([
      busesCollection.find({ active: true }).sort({ bus_number: 1 }).toArray(),
      routesCollection.countDocuments({}),
    ]);

    if (activeBuses.length === 1 && routeCount === 1) {
      buses = await busesCollection.find({}).sort({ active: -1, bus_number: 1 }).toArray();
    }
  }

  return {
    route_name: routeDoc && routeDoc.route_name ? String(routeDoc.route_name).trim() : "",
    buses: (buses || []).map((bus) => ({
      bus_number: bus && bus.bus_number ? String(bus.bus_number).trim() : "",
      active: !!(bus && bus.active),
    })).filter((bus) => bus.bus_number),
  };
}

async function buildTripSegment(routeId, from, to) {
  const stops = await loadOrderedRouteStops(routeId);
  if (!stops.length) {
    return { route_id: routeId || null, from, to, direction: "forward", start_fraction: 0, end_fraction: 1, stops: [] };
  }

  const fromKey = normalizeStopName(from);
  const toKey = normalizeStopName(to);
  const sourceIndex = stops.findIndex((stop) => normalizeStopName(stop.name) === fromKey);
  const destinationIndex = stops.findIndex((stop) => normalizeStopName(stop.name) === toKey);

  if (sourceIndex === -1 || destinationIndex === -1 || sourceIndex === destinationIndex) {
    return { route_id: routeId || null, from, to, direction: "forward", start_fraction: 0, end_fraction: 1, stops: [] };
  }

  const routeDenominator = stops.length > 1 ? stops.length - 1 : 1;
  const routeFractions = stops.map((_, index) => index / routeDenominator);
  const isReverse = sourceIndex > destinationIndex;
  const rangeStart = isReverse ? destinationIndex : sourceIndex;
  const rangeEnd = isReverse ? sourceIndex : destinationIndex;
  const segment = stops.slice(rangeStart, rangeEnd + 1);
  const segmentDenominator = segment.length > 1 ? segment.length - 1 : 1;
  const orderedSegment = isReverse ? segment.slice().reverse() : segment;
  const orderedIndices = orderedSegment.map((stop) => stops.findIndex((candidate) => candidate.stop_id === stop.stop_id && candidate.name === stop.name));
  const startFraction = routeFractions[rangeStart] ?? 0;
  const endFraction = routeFractions[rangeEnd] ?? 1;

  return {
    route_id: routeId || null,
    from,
    to,
    direction: isReverse ? "reverse" : "forward",
    start_fraction: startFraction,
    end_fraction: endFraction,
    stops: orderedSegment.map((stop, index) => ({
      ...stop,
      route_fraction: routeFractions[orderedIndices[index]] ?? (orderedSegment.length === 1 ? 1 : index / segmentDenominator),
      segment_fraction: orderedSegment.length === 1 ? 1 : index / segmentDenominator,
    })),
  };
}

router.get("/health", (req, res) => res.json({ ok: true }));

router.get("/stops", async (req, res) => {
  const routeId = (req.query.routeId || "").trim();

  const query = {};
  if (routeId) query.route_id = routeId;

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
  const stops = await loadOrderedRouteStops(routeId);

  res.json({ stops });
});

router.get("/trip-segment", async (req, res) => {
  const routeId = (req.query.routeId || "").trim();
  const from = (req.query.from || "").trim();
  const to = (req.query.to || "").trim();

  const segment = await buildTripSegment(routeId, from, to);
  res.json(segment);
});

router.get("/search-routes", async (req, res) => {
  const from = (req.query.from || "").trim();
  const to = (req.query.to || "").trim();

  if (!from || !to) {
    return res.json({ routes: [] });
  }

  const routes = [];
  const routeIds = await BusStop.distinct("route_id");

  for (const rawRouteId of routeIds) {
    const routeId = String(rawRouteId || "").trim();
    if (!routeId) continue;
    const segment = await buildTripSegment(routeId, from, to);
    if (!segment.stops.length) continue;
    const meta = await loadRouteSearchMetadata(routeId);
    const departureTime = segment.stops[0].arrival_time || null;
    const selectedBus = meta.buses.find((bus) => bus.active) || meta.buses[0] || { bus_number: "", active: false };

    routes.push({
      _id: routeId,
      route_id: routeId,
      route_name: meta.route_name || "",
      from,
      to,
      bus_number: selectedBus.bus_number || "",
      active: !!selectedBus.active,
      departure_time: departureTime,
    });
  }

  routes.sort((a, b) => {
    if (Boolean(b.active) !== Boolean(a.active)) return Number(Boolean(b.active)) - Number(Boolean(a.active));
    const timeCompare = String(a.departure_time || "").localeCompare(String(b.departure_time || ""));
    if (timeCompare) return timeCompare;
    return String(a.bus_number || "").localeCompare(String(b.bus_number || ""));
  });

  res.json({ routes });
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

  async function findLatest(query) {
    return LiveLocation.findOne(query).sort({ timestamp: -1, _id: -1 }).lean();
  }

  let doc = null;
  if (routeId && busNumber) {
    doc = await findLatest({ route_id: routeId, bus_number: busNumber });
  }
  if (!doc && busNumber) {
    doc = await findLatest({ bus_number: busNumber });
  }
  if (!doc && routeId) {
    doc = await findLatest({ route_id: routeId });
  }
  if (!doc) {
    doc = await findLatest({});
  }

  if (!doc) return res.status(404).json({ message: "No live location found" });

  const lat = typeof doc.latitude === "number" ? doc.latitude : null;
  const lng = typeof doc.longitude === "number" ? doc.longitude : null;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(500).json({ message: "Invalid live location data" });
  }

  res.json({
    lat,
    lng,
    routeId: doc.route_id || null,
    busNumber: doc.bus_number || null,
    timestamp: doc.timestamp || null,
  });
});

router.post("/auth/register", async (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

  const exists = await User.findOne({ email }).lean();
  if (exists) return res.status(409).json({ message: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });

  const sessionUser = { id: user._id.toString(), email: user.email, name: user.name || "" };
  createSession(res, sessionUser);
  const token = signToken(sessionUser);
  res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name || "" } });
});

router.post("/auth/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Account not found. Please register first." });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const sessionUser = { id: user._id.toString(), email: user.email, name: user.name || "" };
  createSession(res, sessionUser);
  const token = signToken(sessionUser);
  res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name || "" } });
});

router.post("/auth/logout", (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.get("/me", authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
