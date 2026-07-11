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
index.html          Page markup (map, site list, response dialog)
css/style.css        Styling (light/dark aware)
js/config.js          Your Supabase keys, neighbourhood, sites, categories
js/app.js             App logic: map, ranking UI, Supabase reads/writes, results chart
supabase/schema.sql   Database tables + row-level security policies
```
