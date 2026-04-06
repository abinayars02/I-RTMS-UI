const params = new URLSearchParams(location.search);
const routeId = params.get("id");

let routeCoordinates = [];
let averageSpeed = 40;
let map, busMarker;

async function loadRoute() {
  const route = await getRouteDetails(
    routeId,
    params.get("from"),
    params.get("to")
  );
  if (route.message || !route.coordinates || route.coordinates.length < 2) {
    document.body.innerHTML = "<p>Route not found or invalid data.</p>";
    return;
  }

  averageSpeed = route.averageSpeed || 40;
  routeCoordinates = route.coordinates.map((c) => [c.lat, c.lng]);

  map = L.map("map").setView(routeCoordinates[0], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  L.polyline(routeCoordinates, { color: "blue" }).addTo(map);
  busMarker = L.marker(routeCoordinates[0]).addTo(map);

  if (typeof startRealtime === "function") startRealtime();
}

loadRoute();
