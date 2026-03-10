document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const routeId = params.get("id");
  const fromPlace = params.get("from");
  const toPlace = params.get("to");

  const route = await getRouteDetails(routeId, fromPlace, toPlace);
  if (route.message) {
    document.getElementById("routeTitle").innerText = "Route not found";
    return;
  }

  const coordinates = (route.coordinates || []).map(c => [c.lat, c.lng]);
  if (coordinates.length < 2) {
    document.getElementById("routeTitle").innerText = route.routeName || "Route";
    document.getElementById("distance").innerText = "—";
    document.getElementById("eta").innerText = "—";
    document.getElementById("countdown").innerText = "—";
    return;
  }

  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];

  document.getElementById("routeTitle").innerText =
    (route.from && route.to) ? `${route.routeName} (${route.from} → ${route.to})` : route.routeName;
  document.getElementById("distance").innerText = route.distance;
  document.getElementById("eta").innerText =
    (route.eta.hours || 0) + "h " + (route.eta.minutes || 0) + "m";

  const map = L.map("map").setView(startPoint, 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  const polyline = L.polyline(coordinates, {
    color: "#e8b923",
    weight: 6,
    opacity: 0.9
  }).addTo(map);

  const bounds = L.latLngBounds(coordinates);

  L.marker(startPoint, {
    icon: L.divIcon({
      className: "map-marker-you",
      html: '<div class="marker-pin marker-start" title="Start / You are here"><span>Start</span></div>',
      iconSize: [36, 46],
      iconAnchor: [18, 46]
    })
  }).addTo(map).bindPopup("<b>Start</b><br>" + (route.from || "Your location"));

  L.marker(endPoint, {
    icon: L.divIcon({
      className: "map-marker-dest",
      html: '<div class="marker-pin marker-dest" title="Destination"><span>End</span></div>',
      iconSize: [36, 46],
      iconAnchor: [18, 46]
    })
  }).addTo(map).bindPopup("<b>Destination</b><br>" + (route.to || "Destination"));

  const busIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/61/61231.png",
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const busMarker = L.marker(startPoint, { icon: busIcon }).addTo(map);

  map.fitBounds(bounds.pad(0.15));

  let userLocationMarker = null;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        userLocationMarker = L.marker([userLat, userLng], {
          icon: L.divIcon({
            className: "map-marker-you",
            html: '<div class="marker-pin marker-you" title="You are here"><span>You</span></div>',
            iconSize: [36, 46],
            iconAnchor: [18, 46]
          })
        }).addTo(map).bindPopup("<b>You are here</b><br>Current location");
        bounds.extend([userLat, userLng]);
        map.fitBounds(bounds.pad(0.2));
      },
      function () { /* use start as "Start" only */ }
    );
  }

  const totalMinutes = route.eta.totalMinutes != null ? route.eta.totalMinutes : (route.eta.hours || 0) * 60 + (route.eta.minutes || 0);
  animateBus(busMarker, coordinates, totalMinutes);
  runCountdown(totalMinutes);
});

function runCountdown(totalMinutes) {
  let countdownSeconds = totalMinutes * 60;
  const countdownEl = document.getElementById("countdown");

  const countdownInterval = setInterval(() => {
    if (countdownSeconds <= 0) {
      clearInterval(countdownInterval);
      countdownEl.innerText = "Arrived";
      return;
    }
    const m = Math.floor(countdownSeconds / 60);
    const s = countdownSeconds % 60;
    countdownEl.innerText = `${m}m ${s}s`;
    countdownSeconds--;
  }, 1000);
}

function animateBus(marker, coords, totalMinutes) {
  let index = 0;
  const totalSteps = coords.length - 1;
  if (totalSteps < 1) return;

  const totalMs = totalMinutes * 60 * 1000;
  const intervalTime = totalMs / (totalSteps * 50);

  function move() {
    if (index >= totalSteps) return;

    const start = coords[index];
    const end = coords[index + 1];
    let step = 0;
    const steps = 50;
    const latStep = (end[0] - start[0]) / steps;
    const lngStep = (end[1] - start[1]) / steps;

    const moveInterval = setInterval(() => {
      if (step >= steps) {
        clearInterval(moveInterval);
        index++;
        move();
        return;
      }
      const newLat = start[0] + latStep * step;
      const newLng = start[1] + lngStep * step;
      marker.setLatLng([newLat, newLng]);
      step++;
    }, intervalTime);
  }

  move();
}
