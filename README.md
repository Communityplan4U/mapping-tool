# Community Land Use Tool

A simple web tool for community members to say how they'd like public land
in their neighbourhood to be used. Residents see designated public sites on
a map, rank possible uses for each site (park, housing, garden, etc.),
leave a comment, and support ideas other residents have submitted.

Currently configured for **Little Jamaica, Toronto**. No sites are
configured yet — add real public land parcels to `js/config.js` before
launching (see below).

## How it works

- **Map** — [Leaflet](https://leafletjs.com/) + OpenStreetMap, no API key
  needed. Each marker is a public land site.
- **Address search** — [Leaflet Control Geocoder](https://github.com/perliedman/leaflet-control-geocoder),
  backed by OpenStreetMap's free Nominatim geocoding service, no API key
  needed.
- **Fullscreen / share controls** — built with the browser's native
  Fullscreen API and Clipboard API, no extra library.
- **Contribution counter** — a live count of all submitted rankings, shown
  in the header.
- **Per-site survey** — residents drag (or use ▲▼) to rank a fixed list of
  possible uses from most to least wanted, plus an optional comment.
- **Community ideas** — everyone's submitted rankings/comments are listed
  per site, and residents can upvote ("support") the ones they agree with.
- **Results** — an aggregated bar chart per site shows which uses have the
  most community support.
- **Click-anywhere feedback** — not limited to the predefined sites:
  clicking any point on the map opens a small form (category + comment)
  and drops a square marker there, colored by category (`themes` in
  `js/config.js`). A "Community feedback" panel lets residents toggle
  each category on/off, the same way the open data layers work, plus a
  bar chart showing how much feedback each category has received across
  the whole map. Clicking a shape from an **open data layer** opens the
  same form pre-filled with that layer's category, so residents can also
  leave feedback about something already on the map instead of only
  empty ground.
- **Shared category taxonomy** — open data layers and community feedback
  both use the same 8 categories (`themes` in `js/config.js`), based on
  the Little Jamaica Community Development Action Plan's 5 focus areas
  plus 3 added categories to cover things the plan doesn't name but the
  map needs. See "Open data map layers" below.
- **Base layer switcher** — a layers control (top-right on the map) swaps
  between [CARTO Positron](https://carto.com/basemaps) (a light, minimal
  street basemap chosen to stay out of the way of the site's own colors)
  and Esri World Imagery satellite tiles, both free with no API key.
- **Reporting view** (`admin.html`) — a read-only page listing every site
  submission and map comment as sortable tables, with CSV export, for
  planners who don't have (or don't need) Supabase dashboard access. Shows
  the same publicly-readable data as the rest of the site — nothing
  additional is exposed.
- **Backend** — [Supabase](https://supabase.com) (free tier), used only as
  a hosted Postgres database via its JS client. No server to run or
  maintain.

There is no login system — submissions are anonymous, identified only by a
random token stored in the visitor's browser (used to let people toggle
their own upvotes on/off).

Residents aren't limited to the predefined `sites` in `js/config.js` —
searching an address opens the same ranking/comment form for that
location. Its `site_id` is derived from the searched coordinates
(`search-<lat>-<lng>`), so searching the same address again lands on the
same thread. These ad-hoc submissions aren't shown as map markers or in
the site list (only the configured `sites` are) — they exist in the
`submissions` table and count toward the contribution counter, but
reviewing them means querying Supabase directly by `site_id LIKE
'search-%'`.

## Click-anywhere map feedback

Separate from the per-site ranking system: click the **📍 Add a feedback
marker** button, then click any point on the map. The clicked point is
reverse-geocoded to a street address (OpenStreetMap Nominatim, the same
free service the address search box uses), and a dialog opens showing
that address plus every existing comment left at it — anyone can add
another comment to the same address rather than each click creating an
isolated, disconnected pin. One marker is shown per unique address (not
per comment), colored by whichever category was posted there first.
Markers are always square regardless of category, so a resident's own
feedback is never visually confused with an open data layer's
circle/diamond/triangle markers or a predefined site's pin.

You don't have to click empty ground to leave feedback: clicking any
shape from an **open data layer** opens its popup with a "Leave feedback
about this" button, which opens this same dialog pre-filled with that
layer's category. The location used is the feature's own coordinates
(its point, or the centre of its polygon), and the address field is
filled from the feature's own data first (a City of Toronto field like
`ADDRESS_FULL`, `SOURCE_ADDRESS`, `Address`, `AREA_DESC`, etc., depending
on the dataset) rather than re-reverse-geocoding — falling back to
reverse geocoding only if the feature has nothing address-like.

- **Categories** are defined in `themes` in `js/config.js` — each has an
  `id`, `label`, and `color`. Add, remove, or recolor categories there;
  the dropdown, the "Community feedback" toggle panel, and the "Map
  layers" panel are all generated from this list. See "Open data map
  layers" below for how layers are assigned to categories.
- **Threading by address**: matching is an exact string match against the
  `address` column (same approach the address-search feature already uses
  for its `site_id`) — two clicks that Nominatim resolves to slightly
  different address strings won't merge into one thread. If reverse
  geocoding fails or returns nothing, the comment still saves; it just
  falls back to being grouped by its exact lat/lng instead (so it won't
  join a thread other visitors can find by clicking nearby).
- **Voting**: each comment has independent up/down voting (`map_comment_votes`
  table) — distinct from the upvote-only "support" mechanic on site
  submissions. Voting the same direction again retracts your vote; voting
  the other direction switches it.
- **Storage**: `map_comments` and `map_comment_votes` tables in Supabase
  (added by `supabase/schema.sql` — re-run it if your project predates
  this feature, it's safe to run multiple times). Everything here is
  anonymous and public, same as site submissions, and comments count
  toward the header's contribution counter.
- **Moderation**: same approach as everything else — no in-app edit/delete,
  review and remove rows from the Supabase Table Editor.

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

**Troubleshooting "permission denied for table X"**: this is a different
error from an RLS policy problem — it means the `anon` role doesn't have
basic read/write access to that table at all, usually because it's a table
added after the initial setup (RLS policies were created, but the
underlying grant wasn't). Fix: re-run `supabase/schema.sql` — it now
includes explicit `grant` statements for every table, safe to run as many
times as you like.

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
see its details (and to leave feedback about it — see "Click-anywhere map
feedback" above), which helps them see what's already there before
proposing a new use.

**Categories, not individual layers:** the "Map layers" panel doesn't list
every dataset separately — it lists the 8 categories from `themes` in
`js/config.js` (the same categories "Community feedback" uses), and only
shows a checkbox for a category if at least one layer is assigned to it.
Turning a category on loads and shows every layer assigned to it at once;
turning it off hides all of them. This keeps the panel short regardless of
how many individual datasets get added later, and means a resident never
has to figure out which of several similarly-named layers to turn on to
see, say, everything related to housing.

The current 8 categories are the Little Jamaica Community Development
Action Plan's 5 focus areas — **Governance**, **Housing**, **Commercial &
Non-Profit Spaces**, **Employment**, **Cultural Identity & Stewardship** —
plus 3 added to cover things the plan doesn't name but the map needs:
**Parks & Public Realm**, **Transportation**, and **Community Services &
Institutions**. Not every category has to have a matching open data
layer — Commercial & Non-Profit Spaces and Employment currently exist as
comment-only categories in "Community feedback", since no fitting City of
Toronto dataset exists yet for this area. Add a layer for one by giving it
that `theme` id in `data/sources.json`.

**Splitting one source into layers under different categories:** some City
of Toronto datasets mix locations that belong in different categories —
for example, the Real Estate Asset Inventory includes administrative
land/buildings (Governance), parks-department land/buildings that overlap
what the Green Spaces / Parks & Recreation layers already show (Parks &
Public Realm), and carparks (Transportation). Rather than showing the same
location twice under two categories, `data/sources.json` can list the same
source `file`/`url` under multiple layer entries with complementary
`filter`/`excludeFilter` values, so each feature ends up in exactly one of
them — see the `real-estate-*` layers for a worked example. A `filter`/
`excludeFilter` value can be:

- a plain value — exact match against that property;
- an array of values — matches if the property equals any of them;
- `{ "contains": "TEXT" }` — case-insensitive substring match (e.g. every
  property description containing "CARPARK"), for when there's no clean
  categorical field to match on exactly.

`filter` keeps only features matching every key given; `excludeFilter`
drops features instead of keeping them, and can itself be an array of
filter objects to drop features matching *any* of several unrelated
reasons (e.g. "is a park" OR "is a carpark") — see `real-estate-land`'s
`excludeFilter`.

**How it works:** `data/sources.json` lists the layers (a label, which
`theme` id it belongs to, and where to read the source GeoJSON from) and a
bounding box for your neighbourhood. Running `scripts/fetch-open-data.js`
reads each source, keeps only the shapes that overlap the bounding box,
and writes the trimmed result to `data/<layer id>.geojson`, which the app
loads. Data is trimmed ahead of time rather than live in the browser, so
the map stays fast regardless of how big the source file is.

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
download link on Toronto's Open Data Portal (or elsewhere), pick which of
the 8 categories in `themes` (`js/config.js`) it best fits, and add an
entry to the `layers` array in `data/sources.json` — either:

```json
{ "id": "parks", "label": "Parks", "theme": "parks-public-realm", "url": "https://.../some-dataset-4326.geojson" }
```

or, to commit the file instead of fetching it live:

```json
{ "id": "parks", "label": "Parks", "theme": "parks-public-realm", "file": "data/raw/parks.geojson" }
```

(and put the downloaded file at `data/raw/parks.geojson`). Use a source
already in EPSG:4326 (plain latitude/longitude — usually flagged in the
filename, as in "...-4326.geojson") so no reprojection is needed. Then
re-run the script (or, for a `url` layer, wait for the next scheduled run)
to generate `data/parks.geojson`.

The layer's markers/outline are colored using its category's color from
`themes` — there's no per-layer color to set.

**Run it locally:**

```bash
node scripts/fetch-open-data.js
```

**Adjusting the area covered:** edit the four numbers under `bbox` in
`data/sources.json` — `minLng`/`minLat`/`maxLng`/`maxLat` — to widen or
narrow the box features are kept within, then re-run the script.

**Telling layers within the same category apart:** since all layers in a
category share one color, a category with more than one point layer needs
a second visual channel so its layers don't look identical on the map.
Set `"shape"` on a point layer in `data/sources.json` to `"circle"`
(default), `"diamond"`, or `"triangle"` — e.g. the `parks-public-realm`
category currently has two point layers (Parks & Recreation Facilities,
Real Estate Asset Inventory (Park Buildings)), each given a different
shape. A category with only one point layer doesn't need `"shape"` set at
all. Polygon/line layers can similarly be set `"dashed": true` to render a
dashed outline when two polygon layers land in the same category — e.g.
Real Estate Asset Inventory (Park Land) is dashed to stay distinct from
Green Spaces' solid outline.

**Drawing the actual property shape instead of a point:** most open data
locations are just a single lat/lng (a School's or Library's address
point, say) with no building outline of their own, so by default they
render as a small circle/diamond/triangle marker. Set `"footprintSource"`
on a point layer to the path of a polygon GeoJSON file (typically
`data/raw/land-asset-inventory.geojson`, since the Real Estate Asset
Inventory already has real property boundary polygons for City-owned
land) and `scripts/fetch-open-data.js` will, for every point in that
layer, look for a polygon in the footprint source it falls inside and use
that polygon's outline instead of a marker — feature properties (popup
content, "Leave feedback about this", etc.) are otherwise unchanged.
Points with no containing polygon (privately-owned locations, e.g. most
Places of Worship) are left as points and keep rendering as a marker, so
this is safe to add to any point layer speculatively — check the "X
matched to a property footprint" count the script prints per layer to see
how many actually got one.

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
admin.html                             Reporting view markup (planners' read-only tables)
css/style.css                          Styling (light/dark aware)
js/config.js                           Your Supabase keys, neighbourhood, sites, categories, themes
js/app.js                              App logic: map, ranking UI, Supabase reads/writes, results chart, open data layers
js/admin.js                            Reporting view logic: Supabase reads, tables, CSV export
supabase/schema.sql                    Database tables + row-level security policies
data/sources.json                      Open data layer list (with theme/shape) + neighbourhood bounding box (edit this)
data/*.geojson                         Generated layer shapes (do not hand-edit — see below)
scripts/fetch-open-data.js             Downloads + trims open data sources into data/*.geojson
.github/workflows/update-open-data.yml Runs that script on a schedule and commits changes
```
