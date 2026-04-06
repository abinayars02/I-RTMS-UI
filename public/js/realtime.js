let index = 0;
let segmentEtaMinutes = null;

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
async function loadSegmentEta() {
  if (!params || typeof fetchTripSegment !== "function") return;
  try {
    const segment = await fetchTripSegment({
      routeId: routeId,
      from: params.get("from"),
      to: params.get("to")
    });
    const minutes = getEtaMinutesFromStops(segment && segment.stops);
    if (minutes != null) {
      segmentEtaMinutes = minutes;
    }
  } catch (_) {
    // keep existing ETA text if segment timing is unavailable
  }
}
function updateETA() {
  if (segmentEtaMinutes == null) return;
  eta.innerText = segmentEtaMinutes + " mins";
}
function startRealtime() {
  loadSegmentEta().finally(() => {
    updateETA();
    setInterval(() => {
    if (index >= routeCoordinates.length-1) {
      eta.innerText = "Arrived";
      return;
    }
    index++;
    busMarker.setLatLng(routeCoordinates[index]);
    updateETA();
    }, 3000);
  });
}
