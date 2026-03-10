const DEFAULT_STOPS = ["Surandai", "Alangulam"];

const COORDS_SURANDAI_ALANGULAM = [
  { lat: 8.977486, lng: 77.420504 },
  {lat: 8.937650, lng: 77.448929},
  { lat: 8.879476, lng: 77.454756 },
  { lat: 8.867208, lng: 77.495119 }
];

const COORDS_ALANGULAM_SURANDAI = [...COORDS_SURANDAI_ALANGULAM].reverse();

const DEFAULT_ROUTES = [
  {
    _id: "route-surandai-alangulam",
    routeName: "Surandai - Alangulam",
    busNumber: "95B",
    from: "Surandai",
    to: "Alangulam",
    distance: 25,
    eta: { hours: 0, minutes: 43, totalMinutes: 43 },
    coordinates: COORDS_SURANDAI_ALANGULAM,
    stops: ["Surandai","Keela Surandai","Bungalow Surandai","Vilakku Stop","VK Puthur Main Stop","VK Puthur 2nd Stop","Kaluneer Kulam Main Stop","Kaluneer Kulam 2nd Stop","Muthukrishnaperi", "Athiyoothu", "Alangulam"]
  },
  {
    _id: "route-alangulam-surandai",
    routeName: "Alangulam - Surandai",
    busNumber: "105A",
    from: "Alangulam",
    to: "Surandai",
    distance: 25,
    eta: { hours: 0, minutes: 43, totalMinutes: 43 },
    coordinates: COORDS_ALANGULAM_SURANDAI,
    stops: ["Surandai","Keela Surandai","Bungalow Surandai","Vilakku Stop","VK Puthur Main Stop","VK Puthur 2nd Stop","Kaluneer Kulam Main Stop","Kaluneer Kulam 2nd Stop","Muthukrishnaperi", "Athiyoothu", "Alangulam"]
  }
];

async function apiGetJson(path) {
  const res = await fetch(path, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
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

function searchRoutes(from, to) {
  const f = (from || "").trim();
  const t = (to || "").trim();
  if (!f || !t) return Promise.resolve([]);
  const routes = DEFAULT_ROUTES.filter(
    (r) => r.from === f && r.to === t
  );
  if (routes.length) return Promise.resolve(routes);

  // For any stop combination, always show a default bus (95B).
  // We reuse the Surandai→Alangulam geometry for the map view.
  return Promise.resolve([
    {
      _id: "route-surandai-alangulam",
      routeName: `${f} - ${t}`,
      busNumber: "95B",
      from: f,
      to: t,
      distance: 25,
      eta: { hours: 0, minutes: 43, totalMinutes: 43 },
      coordinates: COORDS_SURANDAI_ALANGULAM,
      stops: [f, t],
    },
  ]);
}

function getRouteDetails(id, from, to) {
  let route = DEFAULT_ROUTES.find((r) => r._id === id);
  if (!route) {
    return Promise.resolve({ message: "Route not found" });
  }
  const fromPlace = (from || "").trim();
  const toPlace = (to || "").trim();
  const effectiveFrom = fromPlace || route.from;
  const effectiveTo = toPlace || route.to;

  // Keep the original route geometry (line) but show the user's selected from/to labels.
  return Promise.resolve({
    _id: route._id,
    routeName: (fromPlace && toPlace) ? `${effectiveFrom} - ${effectiveTo}` : route.routeName,
    busNumber: route.busNumber || "95B",
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
  const data = await apiGetJson(url);
  return data;
}

async function fetchRouteStops(opts) {
  const routeId = opts && opts.routeId ? String(opts.routeId) : "";
  const qs = new URLSearchParams();
  if (routeId) qs.set("routeId", routeId);
  const url = "/api/route-stops" + (qs.toString() ? `?${qs.toString()}` : "");
  const data = await apiGetJson(url);
  return Array.isArray(data.stops) ? data.stops : [];
}
