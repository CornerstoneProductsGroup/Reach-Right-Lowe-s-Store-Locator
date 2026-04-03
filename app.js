const DIRECTORY_PATH = "./data/lowes-store-directory.json";

const storeInput = document.getElementById("storeNumbers");
const mapButton = document.getElementById("mapButton");
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

let directory = {};
let markers = [];
let mappedRows = [];

async function loadDirectory() {
  try {
    const response = await fetch(DIRECTORY_PATH);
    if (!response.ok) {
      throw new Error(`Directory not found at ${DIRECTORY_PATH}`);
    }
    directory = await response.json();
    const count = Object.keys(directory).length;
    statusEl.textContent = `Ready. Loaded ${count} stores from local directory.`;
  } catch (error) {
    directory = {};
    statusEl.textContent = "Ready. Local directory not found, using live lookup only.";
  }
}

function parseStoreNumbers(raw) {
  const numbers = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/[^0-9]/g, ""))
    .filter(Boolean);

  return [...new Set(numbers)];
}

function clearMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDirectoryStore(storeNumber) {
  const record = directory[storeNumber];
  if (!record) {
    return null;
  }

  return {
    storeNumber,
    name: record.name || `Lowe's #${storeNumber}`,
    address: record.address || "",
    lat: Number(record.lat),
    lng: Number(record.lng),
    source: "local"
  };
}

async function geocodeAddress(address) {
  const endpoint = "https://nominatim.openstreetmap.org/search";
  const query = new URLSearchParams({
    q: address,
    format: "json",
    addressdetails: "1",
    limit: "1",
    countrycodes: "us"
  });

  const response = await fetch(`${endpoint}?${query.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Geocode request failed");
  }

  const rows = await response.json();
  if (!rows.length) {
    return null;
  }

  return {
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon),
    address: rows[0].display_name
  };
}

async function lookupByStoreNumber(storeNumber) {
  const queries = [
    `Lowe's Home Improvement #${storeNumber}, USA`,
    `Lowe's store ${storeNumber}, USA`
  ];

  for (const q of queries) {
    const geo = await geocodeAddress(q);
    if (geo) {
      return {
        storeNumber,
        name: `Lowe's #${storeNumber}`,
        address: geo.address,
        lat: geo.lat,
        lng: geo.lng,
        source: "osm"
      };
    }
    await wait(900);
  }

  return null;
}

async function resolveStore(storeNumber) {
  const fromDirectory = normalizeDirectoryStore(storeNumber);
  if (!fromDirectory) {
    return lookupByStoreNumber(storeNumber);
  }

  const hasCoords = Number.isFinite(fromDirectory.lat) && Number.isFinite(fromDirectory.lng);
  if (hasCoords) {
    return fromDirectory;
  }

  if (!fromDirectory.address) {
    return null;
  }

  const geocoded = await geocodeAddress(fromDirectory.address);
  if (!geocoded) {
    return null;
  }

  return {
    ...fromDirectory,
    address: fromDirectory.address,
    lat: geocoded.lat,
    lng: geocoded.lng,
    source: "local+osm"
  };
}

function renderRows(rows) {
  if (!rows.length) {
    resultsBody.innerHTML = "<tr><td colspan=\"4\">No stores mapped yet.</td></tr>";
    return;
  }

  const html = rows
    .map((row) => {
      const status = row.mapped ? "Mapped" : "Not found";
      const address = row.address || "-";
      const source = row.source || "-";
      return `
        <tr>
          <td>${row.storeNumber}</td>
          <td>${address}</td>
          <td>${source}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");

  resultsBody.innerHTML = html;
}

function plotMappedRows(rows) {
  clearMarkers();
  const mapped = rows.filter((r) => r.mapped);

  mapped.forEach((row) => {
    const marker = L.marker([row.lat, row.lng]).addTo(map);
    marker.bindPopup(`<strong>Store #${row.storeNumber}</strong><br>${row.address}`);
    markers.push(marker);
  });

  if (mapped.length === 0) {
    map.setView([39.8283, -98.5795], 4);
    return;
  }

  const bounds = L.latLngBounds(mapped.map((r) => [r.lat, r.lng]));
  map.fitBounds(bounds, { padding: [30, 30] });
}

function toCsv(rows) {
  const headers = ["store_number", "address", "lat", "lng", "source", "status"];
  const csvRows = [headers.join(",")];

  rows.forEach((row) => {
    const cells = [
      row.storeNumber,
      row.address || "",
      row.lat ?? "",
      row.lng ?? "",
      row.source || "",
      row.mapped ? "mapped" : "not_found"
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`);

    csvRows.push(cells.join(","));
  });

  return csvRows.join("\n");
}

function exportCsv() {
  const csv = toCsv(mappedRows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  a.href = url;
  a.download = `reach-right-lowes-stores-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function mapStores() {
  const values = parseStoreNumbers(storeInput.value);
  if (!values.length) {
    statusEl.textContent = "Please enter at least one store number.";
    return;
  }

  mapButton.disabled = true;
  exportButton.disabled = true;
  statusEl.textContent = `Resolving ${values.length} stores...`;

  const rows = [];

  for (let i = 0; i < values.length; i += 1) {
    const storeNumber = values[i];
    statusEl.textContent = `Resolving ${i + 1} of ${values.length} (Store #${storeNumber})...`;

    let resolved = null;
    try {
      resolved = await resolveStore(storeNumber);
    } catch (error) {
      resolved = null;
    }

    if (!resolved) {
      rows.push({
        storeNumber,
        address: "",
        lat: null,
        lng: null,
        source: "-",
        mapped: false
      });
      continue;
    }

    rows.push({
      ...resolved,
      mapped: true
    });

    // Keep requests polite for public geocoding services.
    await wait(950);
  }

  mappedRows = rows;
  renderRows(rows);
  plotMappedRows(rows);

  const mappedCount = rows.filter((r) => r.mapped).length;
  const missingCount = rows.length - mappedCount;
  statusEl.textContent = `Done. ${mappedCount} mapped, ${missingCount} not found.`;

  mapButton.disabled = false;
  exportButton.disabled = rows.length === 0;
}

mapButton.addEventListener("click", mapStores);
exportButton.addEventListener("click", exportCsv);

loadDirectory();