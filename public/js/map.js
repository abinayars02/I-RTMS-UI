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
  const orderedStops = await fetchRouteStops({ routeId }).catch(() => []);
  const routeStops = Array.isArray(orderedStops)
    ? orderedStops.filter((stop) =>
        stop &&
        typeof stop.latitude === "number" &&
        typeof stop.longitude === "number"
      )
    : [];
  const coordinates = getRouteCoordinates(routeStops, fromPlace, toPlace, route);
  if (coordinates.length < 2) {
    document.getElementById("routeTitle").innerText = route.routeName || "Route";
    document.getElementById("distance").innerText = "—";
    document.getElementById("eta").innerText = "—";
    document.getElementById("countdown").innerText = "—";
    return;
  }
  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];
  const fullRouteStartLabel = Array.isArray(route.stops) && route.stops.length ? route.stops[0] : (route.from || "Start");
  const fullRouteEndLabel = Array.isArray(route.stops) && route.stops.length ? route.stops[route.stops.length - 1] : (route.to || "Destination");
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
  }).addTo(map).bindPopup("<b>Start</b><br>" + fullRouteStartLabel);

  L.marker(endPoint, {
    icon: L.divIcon({
      className: "map-marker-dest",
      html: '<div class="marker-pin marker-dest" title="Destination"><span>End</span></div>',
      iconSize: [36, 46],
      iconAnchor: [18, 46]
    })
  }).addTo(map).bindPopup("<b>Destination</b><br>" + fullRouteEndLabel);

  const busIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/61/61231.png",
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const busMarker = L.marker(startPoint, { icon: busIcon, opacity: 0 }).addTo(map);

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

  try {
    const [selectedSourceCoord, selectedDestinationCoord] = await Promise.all([
      fetchStopByName({ routeId, name: fromPlace }),
      fetchStopByName({ routeId, name: toPlace })
    ]);

    if (selectedSourceCoord) {
      L.marker(selectedSourceCoord, {
        icon: L.divIcon({
          className: "map-marker-you",
          html: '<div class="marker-pin marker-you" title="Selected source"><span>Src</span></div>',
          iconSize: [36, 46],
          iconAnchor: [18, 46]
        })
      }).addTo(map).bindPopup("<b>Selected Source</b><br>" + (fromPlace || "Source"));
    }

    if (selectedDestinationCoord) {
      L.marker(selectedDestinationCoord, {
        icon: L.divIcon({
          className: "map-marker-dest",
          html: '<div class="marker-pin marker-dest" title="Selected destination"><span>Dst</span></div>',
          iconSize: [36, 46],
          iconAnchor: [18, 46]
        })
      }).addTo(map).bindPopup("<b>Selected Destination</b><br>" + (toPlace || "Destination"));
    }
  } catch (_) {
    // keep existing map behavior if selected stop markers cannot be resolved
  }

  const totalMinutes = await getSegmentEtaMinutes(routeId, fromPlace, toPlace, route);
  document.getElementById("eta").innerText = totalMinutes + " mins";
  startLiveLocation(busMarker, routeId, route.busNumber);
  runCountdown(totalMinutes);
});

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

function getRouteCoordinates(routeStops, fromPlace, toPlace, route) {
  if (Array.isArray(routeStops) && routeStops.length >= 2) {
    const fromKey = normalizeStopName(fromPlace);
    const toKey = normalizeStopName(toPlace);
    const sourceIndex = fromKey
      ? routeStops.findIndex((stop) => normalizeStopName(stop.name) === fromKey)
      : -1;
    const destinationIndex = toKey
      ? routeStops.findIndex((stop) => normalizeStopName(stop.name) === toKey)
      : -1;

    let selectedStops = routeStops;
    if (sourceIndex !== -1 && destinationIndex !== -1 && sourceIndex !== destinationIndex) {
      selectedStops = sourceIndex < destinationIndex
        ? routeStops.slice(sourceIndex, destinationIndex + 1)
        : routeStops.slice(destinationIndex, sourceIndex + 1).reverse();
    }

    const exactCoordinates = selectedStops.map((stop) => [stop.latitude, stop.longitude]);
    if (exactCoordinates.length >= 2) return exactCoordinates;
  }

  return (route.coordinates || []).map((c) => [c.lat, c.lng]);
}

function runCountdown(totalMinutes) {
  let remainingMinutes = totalMinutes;
  const countdownEl = document.getElementById("countdown");

  const countdownInterval = setInterval(() => {
    if (remainingMinutes <= 0) {
      clearInterval(countdownInterval);
      countdownEl.innerText = "Arrived";
      return;
    }
    countdownEl.innerText = `${remainingMinutes} mins`;
    remainingMinutes--;
  }, 60000);
}

function startLiveLocation(marker, routeId, busNumber) {
  async function refresh() {
    try {
      const live = await fetchLiveLocation({ routeId, busNumber });
      const lat = live && typeof live.lat === "number" ? live.lat : null;
      const lng = live && typeof live.lng === "number" ? live.lng : null;

      if (typeof lat === "number" && typeof lng === "number") {
        marker.setLatLng([lat, lng]);
        marker.setOpacity(1);
      } else {
        marker.setOpacity(0);
      }
    } catch (_) {
      marker.setOpacity(0);
    }
  }

  refresh();
  setInterval(refresh, 3000);
}

function parseArrivalMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getEtaMinutesFromStops(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return null;
  const startMinutes = parseArrivalMinutes(stops[0] && stops[0].arrival_time);
  const endMinutes = parseArrivalMinutes(stops[stops.length - 1] && stops[stops.length - 1].arrival_time);
  if (startMinutes == null || endMinutes == null) return null;
  return Math.max(0, endMinutes >= startMinutes ? endMinutes - startMinutes : (endMinutes + 24 * 60) - startMinutes);
}

async function getSegmentEtaMinutes(routeId, fromPlace, toPlace, route) {
  try {
    const segment = await fetchTripSegment({ routeId, from: fromPlace, to: toPlace });
    const minutes = getEtaMinutesFromStops(segment && segment.stops);
    if (minutes != null) return minutes;
  } catch (_) {
    // fall back to existing route ETA
  }

  return route && route.eta && route.eta.totalMinutes != null
    ? route.eta.totalMinutes
    : (route.eta.hours || 0) * 60 + (route.eta.minutes || 0);
}
