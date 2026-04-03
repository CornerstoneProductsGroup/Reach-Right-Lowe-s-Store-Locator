#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const inputPath = process.argv[2] || path.join(cwd, "store-numbers.txt");
const outputPath = path.join(cwd, "data", "lowes-store-directory.json");

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
    address: rows[0].display_name,
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon)
  };
}

async function resolveStoreNumber(storeNumber) {
  const queries = [
    `Lowe's Home Improvement #${storeNumber}, USA`,
    `Lowe's store ${storeNumber}, USA`
  ];

  for (const query of queries) {
    const row = await geocode(query);
    if (row) {
      return {
        name: "Lowe's Home Improvement",
        address: row.address,
        lat: row.lat,
        lng: row.lng
      };
    }
    await sleep(1100);
  }

  return null;
}

async function run() {
  const raw = await fs.readFile(inputPath, "utf8");
  const storeNumbers = [...new Set(
    raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/[^0-9]/g, ""))
      .filter(Boolean)
  )];

  const existing = await fs.readFile(outputPath, "utf8").then(JSON.parse).catch(() => ({}));
  const merged = { ...existing };

  for (let i = 0; i < storeNumbers.length; i += 1) {
    const storeNumber = storeNumbers[i];
    if (merged[storeNumber]) {
      continue;
    }

    process.stdout.write(`Resolving ${i + 1}/${storeNumbers.length}: #${storeNumber}\n`);
    const resolved = await resolveStoreNumber(storeNumber);
    if (resolved) {
      merged[storeNumber] = resolved;
    } else {
      process.stdout.write(`  Not found: #${storeNumber}\n`);
    }

    await sleep(1100);
  }

  await fs.writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  process.stdout.write(`Saved ${Object.keys(merged).length} stores to ${outputPath}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});