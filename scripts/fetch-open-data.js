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

function readLocalJSON(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function normalizeToFeatures(input) {
  if (input.type === "FeatureCollection") return input.features || [];
  if (input.type === "Feature") return [input];
  throw new Error(`Unexpected top-level GeoJSON type: ${input.type}`);
}

async function processLayer(layer, bbox) {
  let raw;
  if (layer.file) {
    console.log(`Reading "${layer.label}" from ${layer.file} …`);
    raw = readLocalJSON(layer.file);
  } else if (layer.url) {
    console.log(`Fetching "${layer.label}" from ${layer.url} …`);
    raw = await fetchJSON(layer.url);
  } else {
    throw new Error(`Layer "${layer.label}" has neither "file" nor "url"`);
  }
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
  if (kept.length === 0 && features.length > 0) {
    console.warn(
      `  Warning: 0 features kept for "${layer.label}" out of ${features.length} fetched — check the bbox in data/sources.json covers this area.`
    );
  }
}

function normalizeBBox(rawBBox) {
  if (!rawBBox) return null;
  // Normalize in case minLng/maxLng or minLat/maxLat were entered swapped
  // (an easy mistake to make by hand) — without this, an inverted box
  // silently matches zero features instead of failing loudly.
  const minLng = Math.min(rawBBox.minLng, rawBBox.maxLng);
  const maxLng = Math.max(rawBBox.minLng, rawBBox.maxLng);
  const minLat = Math.min(rawBBox.minLat, rawBBox.maxLat);
  const maxLat = Math.max(rawBBox.minLat, rawBBox.maxLat);
  if (
    rawBBox.minLng !== minLng ||
    rawBBox.maxLng !== maxLng ||
    rawBBox.minLat !== minLat ||
    rawBBox.maxLat !== maxLat
  ) {
    console.warn(
      "Warning: bbox in data/sources.json had min/max reversed on one axis — auto-corrected. Fix the values in data/sources.json to silence this."
    );
  }
  return { minLng, minLat, maxLng, maxLat };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
  const bbox = normalizeBBox(config.bbox);

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
