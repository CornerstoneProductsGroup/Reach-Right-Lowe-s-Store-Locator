#!/usr/bin/env node

import fs from "node:fs/promises";

const FILE_PATH = "data/lowes-store-directory.json";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(query) {
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
      Accept: "application/json",
      "User-Agent": "ReachRightStoreLocator/1.0"
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
    lng: Number(rows[0].lon)
  };
}

async function run() {
  const raw = await fs.readFile(FILE_PATH, "utf8");
  const data = JSON.parse(raw);
  const entries = Object.entries(data);

  let updated = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const [storeNumber, record] = entries[i];
    const hasCoords = Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng));
    if (hasCoords) {
      continue;
    }

    const query = `${record.address}, USA`;
    process.stdout.write(`Resolving ${i + 1}/${entries.length}: #${storeNumber}\n`);

    const resolved = await geocode(query);
    if (resolved) {
      record.lat = resolved.lat;
      record.lng = resolved.lng;
      updated += 1;
    } else {
      process.stdout.write(`  Not found: #${storeNumber}\n`);
    }

    await sleep(1100);
  }

  await fs.writeFile(FILE_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  process.stdout.write(`Updated ${updated} stores with coordinates.\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
