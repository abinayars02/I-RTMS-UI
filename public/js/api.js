const DEFAULT_STOPS = ["Surandai Bus Stand", "Alangulam Bus Stand"];

const COORDS_SURANDAI_ALANGULAM = [
  { lat: 8.977486, lng: 77.420504 },
  { lat: 8.93765, lng: 77.448929 },
  { lat: 8.879476, lng: 77.454756 },
  { lat: 8.867208, lng: 77.495119 }
];

const COORDS_ALANGULAM_SURANDAI = [...COORDS_SURANDAI_ALANGULAM].reverse();

const DEFAULT_ROUTES = [
  {
    _id: "route-surandai-alangulam",
    routeName: "Surandai Bus Stand - Alangulam Bus Stand",
    busNumber: "95B",
    from: "Surandai Bus Stand",
    to: "Alangulam Bus Stand",
    distance: 25,
    eta: { hours: 0, minutes: 43, totalMinutes: 43 },
    coordinates: COORDS_SURANDAI_ALANGULAM,
    stops: ["Surandai Bus Stand", "Keela Surandai", "Bungalow Stop", "Vilakku Stop", "VK Puthur Main Stop", "VK Puthur 2nd Stop", "Kaluneer Kulam Main Stop", "Kaluneer Kulam 2nd Stop", "Muthukrishnaperi", "Athiyuthu", "Alangulam Bus Stand"]
  },
  {
    _id: "route-alangulam-surandai",
    routeName: "Alangulam Bus Stand - Surandai Bus Stand",
    busNumber: "105A",
    from: "Alangulam Bus Stand",
    to: "Surandai Bus Stand",
    distance: 25,
    eta: { hours: 0, minutes: 43, totalMinutes: 43 },
    coordinates: COORDS_ALANGULAM_SURANDAI,
    stops: ["Surandai Bus Stand", "Keela Surandai", "Bungalow Stop", "Vilakku Stop", "VK Puthur Main Stop", "VK Puthur 2nd Stop", "Kaluneer Kulam Main Stop", "Kaluneer Kulam 2nd Stop", "Muthukrishnaperi", "Athiyuthu", "Alangulam Bus Stand"]
  }
];

async function apiGetJson(path) {
  const res = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) {
    window.location = "/login.html";
    throw new Error(`Unauthorized: ${path}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function isAuthError(error) {
  return String(error && error.message || "").indexOf("Unauthorized:") === 0;
}

async function ensureAuthenticated() {
  try {
    await apiGetJson("/api/me");
    return true;
  } catch (error) {
    if (isAuthError(error)) return false;
    throw error;
  }
}

async function fetchStops() {
  try {
    const data = await apiGetJson("/api/stops");
    if (Array.isArray(data.stops) && data.stops.length) return data.stops;
  } catch (_) {
    // fall back to defaults
  }
  return DEFAULT_STOPS;
}

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

function getRouteStopsForDirection(route) {
  if (!route || !Array.isArray(route.stops)) return [];
  if (
    normalizeStopName(route.from) === "alangulam bus stand" &&
    normalizeStopName(route.to) === "surandai bus stand"
  ) {
    return route.stops.slice().reverse();
  }
  return route.stops.slice();
}

function inferRouteMetadata(from, to) {
  const fromKey = normalizeStopName(from);
  const toKey = normalizeStopName(to);

  for (const route of DEFAULT_ROUTES) {
    const stops = getRouteStopsForDirection(route).map(normalizeStopName);
    const fromIndex = stops.indexOf(fromKey);
    const toIndex = stops.indexOf(toKey);
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
      return {
        busNumber: route.busNumber || "",
        coordinates: route.coordinates,
        routeName: `${from} - ${to}`,
      };
    }
  }

  return {
    busNumber: "",
    coordinates: COORDS_SURANDAI_ALANGULAM,
    routeName: `${from} - ${to}`,
  };
}

function searchRoutes(from, to) {
  const f = (from || "").trim();
  const t = (to || "").trim();
  if (!f || !t) return Promise.resolve([]);

  const qs = new URLSearchParams({ from: f, to: t });
  return apiGetJson("/api/search-routes?" + qs.toString())
    .then(function(data) {
      const routes = data && Array.isArray(data.routes) ? data.routes : [];
      return routes.map(function(route) {
        const meta = inferRouteMetadata(f, t);
        return {
          _id: route._id,
          routeName: route.route_name || meta.routeName,
          busNumber: route.bus_number || meta.busNumber,
          from: f,
          to: t,
          departureTime: route.departure_time || "",
          distance: 25,
          eta: { hours: 0, minutes: 43, totalMinutes: 43 },
          coordinates: meta.coordinates,
          stops: [f, t],
        };
      });
    });
}

function getRouteDetails(id, from, to, busNumber) {
  let route = DEFAULT_ROUTES.find((r) => r._id === id);
  const fromPlace = (from || "").trim();
  const toPlace = (to || "").trim();
  const busNum = (busNumber || "").trim();
  const inferred = inferRouteMetadata(fromPlace, toPlace);

  if (!route && fromPlace && toPlace) {
    route = {
      _id: id || "dynamic-route",
      routeName: `${fromPlace} - ${toPlace}`,
      busNumber: busNum || inferred.busNumber,
      from: fromPlace,
      to: toPlace,
      distance: 25,
      eta: { hours: 0, minutes: 43, totalMinutes: 43 },
      coordinates: inferred.coordinates,
      stops: [fromPlace, toPlace]
    };
  }

  if (!route) {
    return Promise.resolve({ message: "Route not found" });
  }

  const effectiveFrom = fromPlace || route.from;
  const effectiveTo = toPlace || route.to;

  return Promise.resolve({
    _id: route._id,
    routeName: (fromPlace && toPlace) ? `${effectiveFrom} - ${effectiveTo}` : route.routeName,
    busNumber: busNum || route.busNumber || inferred.busNumber || "",
    from: effectiveFrom,
    to: effectiveTo,
    distance: route.distance,
    eta: route.eta,
    coordinates: route.coordinates,
    stops: route.stops
  });
}

async function fetchPassengerCount(opts) {
  const routeId = opts && opts.routeId ? String(opts.routeId) : "";
  const busNumber = opts && opts.busNumber ? String(opts.busNumber) : "";
  const qs = new URLSearchParams();
  if (routeId) qs.set("routeId", routeId);
  if (busNumber) qs.set("busNumber", busNumber);
  const url = "/api/passenger-count" + (qs.toString() ? `?${qs.toString()}` : "");
  const data = await apiGetJson(url);
  return typeof data.count === "number" ? data.count : 0;
}

async function fetchLiveLocation(opts) {
  const routeId = opts && opts.routeId ? String(opts.routeId) : "";
  const busNumber = opts && opts.busNumber ? String(opts.busNumber) : "";
  const qs = new URLSearchParams();
  if (routeId) qs.set("routeId", routeId);
  if (busNumber) qs.set("busNumber", busNumber);
  const url = "/api/live-location" + (qs.toString() ? `?${qs.toString()}` : "");
  return apiGetJson(url);
}

async function fetchRouteStops(opts) {
  const routeId = opts && opts.routeId ? String(opts.routeId) : "";
  const qs = new URLSearchParams();
  if (routeId) qs.set("routeId", routeId);
  const url = "/api/route-stops" + (qs.toString() ? `?${qs.toString()}` : "");
  const data = await apiGetJson(url);
  return Array.isArray(data.stops) ? data.stops : [];
}

async function fetchTripSegment(opts) {
  const routeId = opts && opts.routeId ? String(opts.routeId) : "";
  const from = opts && opts.from ? String(opts.from) : "";
  const to = opts && opts.to ? String(opts.to) : "";
  const qs = new URLSearchParams();
  if (routeId) qs.set("routeId", routeId);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const url = "/api/trip-segment" + (qs.toString() ? `?${qs.toString()}` : "");
  return apiGetJson(url);
}
