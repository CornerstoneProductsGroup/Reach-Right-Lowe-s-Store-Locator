const DIRECTORY_PATH = "./data/lowes-store-directory.json";

const zipInput = document.getElementById("zipCode");
const radiusInput = document.getElementById("radiusMiles");
const searchButton = document.getElementById("searchButton");
const exportButton = document.getElementById("exportButton");
const statusEl = document.getElementById("status");
const resultsBody = document.querySelector("#resultsTable tbody");

const map = L.map("map", {
  zoomControl: true,
  minZoom: 3
}).setView([39.8283, -98.5795], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let stores = [];
let markers = [];
let customerMarker = null;
let lastResults = [];

function isValidCoordinate(value) {
  return Number.isFinite(Number(value));
}

async function geocodeQuery(query) {
  const endpoint = "https://nominatim.openstreetmap.org/search";
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "1",
    countrycodes: "us"
  });

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  if (!rows.length) {
    return null;
  }

  return {
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon),
    label: rows[0].display_name
  };
}

async function lookupZipCenter(zip) {
  const queries = [
    `${zip}, USA`,
    `ZIP ${zip}, USA`
  ];

  for (const query of queries) {
    const resolved = await geocodeQuery(query);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function clearMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];

  if (customerMarker) {
    customerMarker.remove();
    customerMarker = null;
  }
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMiles(aLat, aLng, bLat, bLng) {
  const earthRadiusMi = 3958.8;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);

  const hav = s1 * s1 + Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * s2 * s2;
  return 2 * earthRadiusMi * Math.asin(Math.sqrt(hav));
}

function normalizeStores(directory) {
  return Object.entries(directory)
    .map(([storeNumber, record]) => ({
      storeNumber,
      name: record.name || `Lowe's #${storeNumber}`,
      address: record.address || "",
      lat: Number(record.lat),
      lng: Number(record.lng)
    }))
    .filter((store) => store.address && isValidCoordinate(store.lat) && isValidCoordinate(store.lng));
}

async function loadDirectory() {
  try {
    const response = await fetch(DIRECTORY_PATH);
    if (!response.ok) {
      throw new Error("Unable to load store directory");
    }

    const directory = await response.json();
    stores = normalizeStores(directory);
    statusEl.textContent = `Ready. ${stores.length} stores available.`;
  } catch (error) {
    stores = [];
    statusEl.textContent = "Could not load store list. Please try again later.";
    searchButton.disabled = true;
  }
}

function renderRows(rows) {
  if (!rows.length) {
    resultsBody.innerHTML = '<tr><td colspan="3">No stores found in that range.</td></tr>';
    return;
  }

  const html = rows
    .map((row) => `
      <tr>
        <td>${row.storeNumber}</td>
        <td>${row.address}</td>
        <td>${row.distance.toFixed(1)} mi</td>
      </tr>
    `)
    .join("");

  resultsBody.innerHTML = html;
}

function plotResults(zipCenter, rows) {
  clearMarkers();

  customerMarker = L.circleMarker([zipCenter.lat, zipCenter.lng], {
    radius: 8,
    color: "#115f35",
    fillColor: "#1f6f3d",
    fillOpacity: 0.95
  }).addTo(map);

  customerMarker.bindPopup(`<strong>Search center</strong><br>${zipCenter.label}`);

  rows.forEach((row) => {
    const marker = L.marker([row.lat, row.lng]).addTo(map);
    marker.bindPopup(`<strong>Store #${row.storeNumber}</strong><br>${row.address}<br>${row.distance.toFixed(1)} mi`);
    markers.push(marker);
  });

  const points = [[zipCenter.lat, zipCenter.lng], ...rows.map((row) => [row.lat, row.lng])];
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [30, 30] });
}

function toCsv(rows) {
  const headers = ["store_number", "address", "distance_miles", "lat", "lng"];
  const csvRows = [headers.join(",")];

  rows.forEach((row) => {
    const cells = [
      row.storeNumber,
      row.address,
      row.distance.toFixed(2),
      row.lat,
      row.lng
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`);

    csvRows.push(cells.join(","));
  });

  return csvRows.join("\n");
}

function exportCsv() {
  const csv = toCsv(lastResults);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  a.href = url;
  a.download = `reach-right-nearby-stores-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseZip(raw) {
  return (raw || "").trim().replace(/[^0-9]/g, "").slice(0, 5);
}

async function findStores() {
  const zip = parseZip(zipInput.value);
  const radius = Number(radiusInput.value);

  if (zip.length !== 5) {
    statusEl.textContent = "Enter a valid 5-digit ZIP code.";
    return;
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    statusEl.textContent = "Choose a valid distance.";
    return;
  }

  searchButton.disabled = true;
  exportButton.disabled = true;
  statusEl.textContent = "Finding stores near your ZIP...";

  const zipCenter = await lookupZipCenter(zip);
  if (!zipCenter) {
    statusEl.textContent = "Could not locate that ZIP code. Please try another.";
    searchButton.disabled = false;
    return;
  }

  const nearby = stores
    .map((store) => ({
      ...store,
      distance: distanceMiles(zipCenter.lat, zipCenter.lng, store.lat, store.lng)
    }))
    .filter((store) => store.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  lastResults = nearby;
  renderRows(nearby);
  plotResults(zipCenter, nearby);

  statusEl.textContent = `${nearby.length} store(s) found within ${radius} miles of ${zip}.`;
  searchButton.disabled = false;
  exportButton.disabled = nearby.length === 0;
}

searchButton.addEventListener("click", findStores);
zipInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    findStores();
  }
});
exportButton.addEventListener("click", exportCsv);

loadDirectory();
