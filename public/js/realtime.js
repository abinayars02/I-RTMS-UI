let index = 0;

function distance(a, b) {
  const R = 6371;
  const dLat = (b[0]-a[0])*Math.PI/180;
  const dLng = (b[1]-a[1])*Math.PI/180;
  const aa = Math.sin(dLat/2)**2 +
    Math.cos(a[0]*Math.PI/180) *
    Math.cos(b[0]*Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
}

function updateETA() {
  let total = 0;
  for (let i=index;i<routeCoordinates.length-1;i++) {
    total += distance(routeCoordinates[i], routeCoordinates[i+1]);
  }
  const minutes = Math.round((total/averageSpeed)*60);
  eta.innerText = minutes + " mins";
}

function startRealtime() {
  setInterval(() => {
    if (index >= routeCoordinates.length-1) {
      eta.innerText = "Arrived";
      return;
    }
    index++;
    busMarker.setLatLng(routeCoordinates[index]);
    updateETA();
  }, 3000);
}
