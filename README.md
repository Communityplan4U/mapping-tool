# Community Land Use Tool

A simple web tool for community members to say how they'd like public land
in their neighbourhood to be used. Residents see designated public sites on
a map, rank possible uses for each site (park, housing, garden, etc.),
leave a comment, and support ideas other residents have submitted.

Currently configured for **Little Jamaica, Toronto** with sample site
locations — replace them with your real sites before launching (see below).

## How it works

- **Map** — [Leaflet](https://leafletjs.com/) + OpenStreetMap, no API key
  needed. Each marker is a public land site.
- **Per-site survey** — residents drag (or use ▲▼) to rank a fixed list of
  possible uses from most to least wanted, plus an optional comment.
- **Community ideas** — everyone's submitted rankings/comments are listed
  per site, and residents can upvote ("support") the ones they agree with.
- **Results** — an aggregated bar chart per site shows which uses have the
  most community support.
- **Backend** — [Supabase](https://supabase.com) (free tier), used only as
  a hosted Postgres database via its JS client. No server to run or
  maintain.

There is no login system — submissions are anonymous, identified only by a
random token stored in the visitor's browser (used to let people toggle
their own upvotes on/off).

## Setup

### 1. Create the database (Supabase, free)

1. Sign up at [supabase.com](https://supabase.com) and create a new
   project.
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates
   the `submissions` and `upvotes` tables with public read/insert access.
3. Go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
4. Open [`js/config.js`](js/config.js) and paste them in:

   ```js
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```

The anon key is meant to be public (it's used from browser JS) — access
control is enforced by the row-level security policies in `schema.sql`,
not by keeping the key secret.

### 2. Add your real sites

Still in `js/config.js`, replace the `sites` array with your neighbourhood's
actual public land parcels:

```js
sites: [
  {
    id: "some-unique-id",
    name: "Real site name",
    lat: 43.1234,
    lng: -79.1234,
    description: "Current condition, approximate size, who owns it, etc.",
  },
  // ...
],
```

To get coordinates: right-click the location on
[Google Maps](https://www.google.com/maps) or
[OpenStreetMap](https://www.openstreetmap.org) and copy the latitude/longitude
shown.

Update `neighbourhood.center` / `neighbourhood.zoom` so the map opens
centred on your area, and edit `categories` if you want a different list of
possible land uses.

### 3. Run it locally

This is a static site — any static file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

### 4. Deploy

Push this repo and deploy the static files with any static host, e.g.:

- **GitHub Pages** — Settings → Pages → deploy from branch.
- **Netlify** / **Vercel** — import the repo, no build step required
  (publish directory: repo root).

No environment variables or build step are needed since `supabaseUrl` /
`supabaseAnonKey` are read directly from `js/config.js`.

## Open data map layers

The map can show toggleable overlay layers sourced from the
[City of Toronto's Open Data Portal](https://open.toronto.ca/) (or any
other source that publishes GeoJSON) — e.g. parks, green spaces, ward
boundaries. Residents flip them on with a checkbox and click a shape to
see its details, which helps them see what's already there before
proposing a new use.

**How it works:** `data/sources.json` lists the layers (a label, a colour,
and where to read the source GeoJSON from) and a bounding box for your
neighbourhood. Running `scripts/fetch-open-data.js` reads each source,
keeps only the shapes that overlap the bounding box, and writes the
trimmed result to `data/<layer id>.geojson`, which the app loads. Data is
trimmed ahead of time rather than live in the browser, so the map stays
fast regardless of how big the source file is.

A layer's source is either:

- **`file`** — a GeoJSON file committed in the repo (e.g.
  `data/raw/green-spaces.geojson`). No network access needed to rebuild
  the layer; refreshing means re-downloading the file yourself (from
  [Toronto's Open Data Portal](https://open.toronto.ca/) or elsewhere) and
  replacing it. This is what `green-spaces` uses.
- **`url`** — a live GeoJSON download link. The script fetches it fresh
  each time it runs, so it can be kept in sync automatically (see below)
  without you re-uploading anything.

**Keeping `url`-based layers fresh:** [`.github/workflows/update-open-data.yml`](.github/workflows/update-open-data.yml)
runs the script weekly (and can be triggered manually from the repo's
**Actions** tab → "Update open data layers" → **Run workflow**) and
commits any changes automatically. `file`-based layers are re-trimmed on
the same schedule but only change when you replace the underlying file.

**Adding another dataset** ("other similar files"): find its GeoJSON
download link on Toronto's Open Data Portal (or elsewhere) and add an
entry to the `layers` array in `data/sources.json` — either:

```json
{ "id": "parks", "label": "Parks", "color": "#eda100", "url": "https://.../some-dataset-4326.geojson" }
```

or, to commit the file instead of fetching it live:

```json
{ "id": "parks", "label": "Parks", "color": "#eda100", "file": "data/raw/parks.geojson" }
```

(and put the downloaded file at `data/raw/parks.geojson`). Use a source
already in EPSG:4326 (plain latitude/longitude — usually flagged in the
filename, as in "...-4326.geojson") so no reprojection is needed. Then
re-run the script (or, for a `url` layer, wait for the next scheduled run)
to generate `data/parks.geojson`.

**Run it locally:**

```bash
node scripts/fetch-open-data.js
```

**Adjusting the area covered:** edit the four numbers under `bbox` in
`data/sources.json` — `minLng`/`minLat`/`maxLng`/`maxLat` — to widen or
narrow the box features are kept within, then re-run the script.

**Running out of colors:** the palette this project draws from has 8 fixed
hues, assigned in order as layers were added (see `js/app.js`'s
`buildGeoJSONLayer`/`addLayerToggle`). Once all 8 are used, don't invent a
9th color — reuse one and add a second visual channel so identity still
comes through:

- Point layers: set `"shape": "diamond"` on the layer in `data/sources.json`
  to render a diamond marker instead of a circle.
- Polygon/line layers: set `"dashed": true` to render a dashed outline
  instead of solid.

Both apply automatically to the legend swatch too.

**Adding a layer from a Shapefile instead of GeoJSON:** not every City of
Toronto dataset has a ready-made "-4326.geojson" export — some are only
published as an Esri Shapefile (a `.shp` + `.shx` + `.dbf` + `.prj` set of
files, all required together) in whatever coordinate system the city used
internally (often **NAD27 MTM Zone 10**, not plain latitude/longitude). To
add one:

1. Download all four files and check the `.prj` for the exact projection
   parameters (central meridian, false easting, datum, etc.).
2. Convert to a GeoJSON FeatureCollection in EPSG:4326 with `pyshp` (reads
   the shapefile) and `pyproj` (reprojects coordinates) — see the git
   history for `data/raw/major-transit-station-areas.geojson` for a worked
   example, including the exact `pyproj` CRS string used for NAD27 MTM
   Zone 10.
3. Save the result under `data/raw/<id>.geojson` and add a normal `file`
   entry to `data/sources.json` — from here on it's identical to any other
   layer.

Sanity-check the conversion by looking up a few named features (e.g. a
station or building you know the real location of) and confirming the
output coordinates land in the right place before committing.

## Moderation & limits (read before launching publicly)

- Submissions can't be edited or deleted from the app itself once posted —
  remove spam/inappropriate entries from the **Supabase Table Editor**
  (Project → Table Editor → `submissions`).
- Upvote removal (`toggleUpvote`) is not scoped to "your own" vote at the
  database level, since there's no login system — see the comment in
  `supabase/schema.sql` for the tradeoff. If you need stronger guarantees
  (e.g. one vote per verified resident), add
  [Supabase Auth](https://supabase.com/docs/guides/auth) (email/magic link)
  and update the RLS policies to check `auth.uid()`.
- There's no rate limiting or CAPTCHA — for a small neighbourhood tool this
  is usually fine, but keep an eye on submissions after sharing the link
  widely.

## File structure

```
index.html                             Page markup (map, site list, response dialog)
css/style.css                          Styling (light/dark aware)
js/config.js                           Your Supabase keys, neighbourhood, sites, categories
js/app.js                              App logic: map, ranking UI, Supabase reads/writes, results chart, open data layers
supabase/schema.sql                    Database tables + row-level security policies
data/sources.json                      Open data layer list + neighbourhood bounding box (edit this)
data/*.geojson                         Generated layer shapes (do not hand-edit — see below)
scripts/fetch-open-data.js             Downloads + trims open data sources into data/*.geojson
.github/workflows/update-open-data.yml Runs that script on a schedule and commits changes
```
