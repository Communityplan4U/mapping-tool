#!/usr/bin/env node
// Downloads each open-data GeoJSON layer listed in data/sources.json,
// keeps only features that overlap the configured neighbourhood bounding
// box, and writes the result to data/<layer id>.geojson.
//
// Run manually with `node scripts/fetch-open-data.js`, or let the
// "Update open data layers" GitHub Action run it on a schedule.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCES_PATH = path.join(ROOT, "data", "sources.json");
const OUT_DIR = path.join(ROOT, "data");
const USER_AGENT =
  "community-land-use-tool-open-data-sync (github.com/Communityplan4U/mapping-tool)";

function eachCoord(coords, cb) {
  if (typeof coords[0] === "number") {
    cb(coords);
    return;
  }
  for (const c of coords) eachCoord(c, cb);
}

function geometryBBox(geometry) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  eachCoord(geometry.coordinates, ([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLng, minLat, maxLng, maxLat };
}

function bboxesOverlap(a, b) {
  return (
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng &&
    a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat
  );
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function normalizeToFeatures(input) {
  if (input.type === "FeatureCollection") return input.features || [];
  if (input.type === "Feature") return [input];
  throw new Error(`Unexpected top-level GeoJSON type: ${input.type}`);
}

async function processLayer(layer, bbox) {
  console.log(`Fetching "${layer.label}" …`);
  const raw = await fetchJSON(layer.url);
  const features = normalizeToFeatures(raw);

  const kept = [];
  let skippedNoGeometry = 0;
  for (const feature of features) {
    if (!feature.geometry || !feature.geometry.coordinates) {
      skippedNoGeometry++;
      continue;
    }
    if (bbox && !bboxesOverlap(geometryBBox(feature.geometry), bbox)) continue;
    kept.push({
      type: "Feature",
      geometry: feature.geometry,
      properties: feature.properties || {},
    });
  }

  const geojson = { type: "FeatureCollection", features: kept };
  const outPath = path.join(OUT_DIR, `${layer.id}.geojson`);
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log(
    `  kept ${kept.length} of ${features.length} features` +
      (skippedNoGeometry ? ` (${skippedNoGeometry} had no geometry)` : "") +
      ` -> data/${layer.id}.geojson`
  );
}

async function main() {
  const config = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
  const bbox = config.bbox
    ? {
        minLng: config.bbox.minLng,
        minLat: config.bbox.minLat,
        maxLng: config.bbox.maxLng,
        maxLat: config.bbox.maxLat,
      }
    : null;

  let hadError = false;
  for (const layer of config.layers || []) {
    try {
      await processLayer(layer, bbox);
    } catch (err) {
      hadError = true;
      console.error(`Failed to process "${layer.label}": ${err.message}`);
    }
  }
  if (hadError) process.exitCode = 1;
}

main();
