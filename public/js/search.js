document.addEventListener("DOMContentLoaded", async () => {

  const fromSelect = document.getElementById("from");
  const toSelect = document.getElementById("to");
  const resultContainer = document.getElementById("results");

  const stops = await fetchStops();

  stops.forEach(stop => {
    fromSelect.innerHTML += `<option value="${stop}">${stop}</option>`;
    toSelect.innerHTML += `<option value="${stop}">${stop}</option>`;
  });

  document.getElementById("searchBtn").addEventListener("click", async () => {
    const from = (fromSelect.value || "").trim();
    const to = (toSelect.value || "").trim();

    if (!from || !to) {
      resultContainer.innerHTML = "<p class=\"text-muted\">Please select both source and destination.</p>";
      return;
    }
    if (from === to) {
      resultContainer.innerHTML = "<p class=\"text-muted\">Source and destination must be different.</p>";
      return;
    }

    resultContainer.innerHTML = "<p class=\"text-muted\">Searching routes…</p>";
    const routes = await searchRoutes(from, to);

    resultContainer.innerHTML = "";

    if (routes.length === 0) {
      resultContainer.innerHTML = "<p class=\"text-muted\">No routes found between these locations. Try another pair.</p>";
      return;
    }

    routes.forEach(route => {
      const fromPlace = route.from || from;
      const toPlace = route.to || to;
      const card = document.createElement("div");
      card.className = "route-card";
      card.innerHTML = `
        <h3>${route.routeName}</h3>
        <p><strong>${fromPlace} → ${toPlace}</strong></p>
        <p>Distance: ${route.distance} km &nbsp;|&nbsp; ETA: ${route.eta.hours}h ${route.eta.minutes}m</p>
        <button class="btn-primary" type="button" data-id="${route._id}" data-from="${fromPlace}" data-to="${toPlace}">View on Map</button>
      `;
      card.querySelector("button").addEventListener("click", function () {
        viewDetails(this.dataset.id, this.dataset.from, this.dataset.to);
      });
      resultContainer.appendChild(card);
    });
  });
});

function viewDetails(id, fromPlace, toPlace) {
  const params = new URLSearchParams({ id });
  if (fromPlace) params.set("from", fromPlace);
  if (toPlace) params.set("to", toPlace);
  window.location.href = `bus-details.html?${params.toString()}`;
}
