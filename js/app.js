(function () {
  "use strict";

  const config = window.APP_CONFIG;

  const isConfigured =
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.startsWith("YOUR_") &&
    !config.supabaseAnonKey.startsWith("YOUR_");

  const db = isConfigured
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  if (!isConfigured) {
    document.getElementById("config-warning").hidden = false;
  }

  function getVoterToken() {
    const key = "cplu_voter_token";
    let token = localStorage.getItem(key);
    if (!token) {
      token =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `voter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, token);
    }
    return token;
  }
  const voterToken = getVoterToken();

  // ---------- Icons ----------
  // Purpose-drawn line icons, replacing the emoji glyphs that render
  // differently on every OS and can't take a theme color. Category icons
  // are keyed by theme id (see config.themes); the rest are UI glyphs.
  // Everything uses stroke="currentColor", so an icon inherits whatever
  // color its container sets — white on a category marker, the control's
  // own text color on a map button, so both themes just work.
  const ICON_PATHS = {
    housing:
      '<path d="M4 12l8-6.5 8 6.5"/><path d="M6.5 10.5V19h11v-8.5"/><path d="M10.5 19v-4h3v4"/>',
    "commercial-nonprofit":
      '<path d="M5 9l1-4h12l1 4"/><path d="M5 9a2 2 0 0 0 4.7 0 2 2 0 0 0 4.6 0 2 2 0 0 0 4.7 0"/><path d="M6 10.5V19h12v-8.5"/><path d="M10 19v-4h4v4"/>',
    employment:
      '<rect x="3.5" y="8" width="17" height="11" rx="1.5"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"/><path d="M3.5 12.5h17"/>',
    "cultural-identity":
      '<path d="M12 4l2.2 4.9 5.3.5-4 3.6 1.2 5.2L12 15.9 6.3 18.7l1.2-5.2-4-3.6 5.3-.5z"/>',
    "parks-public-realm":
      '<path d="M12 3.2c-2.7 0-4.3 2.1-3.2 4.4C6.3 7.4 5 9 5 10.7c0 1.7 1.4 3 3.4 3h7.2c2 0 3.4-1.3 3.4-3 0-1.7-1.3-3.3-3.8-3.1C16.3 5.3 14.7 3.2 12 3.2z"/><path d="M12 13.7V20"/>',
    transportation:
      '<rect x="4.5" y="5" width="15" height="11" rx="2"/><path d="M4.5 11.5h15"/><path d="M8 19.5l1-2M16 19.5l-1-2"/><circle cx="8.5" cy="13.6" r="0.7" fill="currentColor" stroke="none"/><circle cx="15.5" cy="13.6" r="0.7" fill="currentColor" stroke="none"/>',
    "community-services":
      '<path d="M4 20h16"/><path d="M5 20v-9l7-4 7 4v9"/><path d="M9 20v-5h6v5"/><path d="M4 11h16"/>',
    "urban-community-planning":
      '<path d="M9 4.5L4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    pin: '<path d="M12 21c4-4.4 6-7.7 6-10.6A6 6 0 0 0 6 10.4C6 13.3 8 16.6 12 21z"/><circle cx="12" cy="10.3" r="2.2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    link: '<path d="M9.5 14.5l5-5"/><path d="M11 7.6l1-1a3.5 3.5 0 0 1 5 5l-1 1"/><path d="M13 16.4l-1 1a3.5 3.5 0 0 1-5-5l1-1"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 1.9-2.4 3.6"/><circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none"/>',
  };

  function svgIcon(name, size) {
    const path = ICON_PATHS[name];
    if (!path) return "";
    const s = size || 18;
    return `<svg class="icon" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  // ---------- Map instruction toast ----------
  const mapToastEl = document.getElementById("map-toast");
  let mapToastTimer = null;
  function showMapToast(message, autoHideMs) {
    if (!mapToastEl) return;
    clearTimeout(mapToastTimer);
    mapToastEl.textContent = message;
    mapToastEl.hidden = false;
    // Reflow so the opacity/transform transition runs on this show.
    void mapToastEl.offsetWidth;
    mapToastEl.classList.add("is-visible");
    if (autoHideMs) mapToastTimer = setTimeout(hideMapToast, autoHideMs);
  }
  function hideMapToast() {
    if (!mapToastEl) return;
    clearTimeout(mapToastTimer);
    mapToastEl.classList.remove("is-visible");
    mapToastTimer = setTimeout(() => {
      mapToastEl.hidden = true;
    }, 220);
  }

  // ---------- Page header / intro ----------
  // Neighbourhood name on the first line, "Public Land Use Tool" on a
  // second (accent-coloured) line — see #page-title span in css/style.css.
  document.getElementById(
    "page-title"
  ).innerHTML = `${escapeHtml(config.neighbourhood.name)}<span>Public Land Use Tool</span>`;
  document.getElementById(
    "page-subtitle"
  ).textContent = `Help decide how public land should be used in ${config.neighbourhood.name}.`;

  // ---------- Contribution counter ----------
  // Counts every piece of click-anywhere map feedback residents have left.
  async function refreshContributionCounter() {
    const el = document.getElementById("contribution-counter");
    if (!db) return;
    el.textContent = "Loading contributions…";
    el.hidden = false;
    const { count, error } = await db
      .from("map_comments")
      .select("*", { count: "exact", head: true });
    if (error || count === null) {
      el.textContent = "Contribution count unavailable";
      return;
    }
    el.textContent = `${count.toLocaleString()} contribution${
      count === 1 ? "" : "s"
    } so far`;
  }
  refreshContributionCounter();

  // ---------- Map ----------
  const helpDialog = document.getElementById("help-dialog");
  document.getElementById("intro-how")?.addEventListener("click", () => {
    helpDialog.showModal();
  });

  const map = L.map("map").setView(
    config.neighbourhood.center,
    config.neighbourhood.zoom
  );

  const streetLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      subdomains: "abcd",
      attribution:
        "&copy; OpenStreetMap contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>",
    }
  ).addTo(map);
  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution:
        "Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    }
  );
  L.control
    .layers(
      { Street: streetLayer, Satellite: satelliteLayer },
      null,
      { position: "topright", collapsed: true }
    )
    .addTo(map);

  // Study-area boundary — always visible for orientation (which of these
  // shapes are actually "in scope" for this tool), not a feedback layer,
  // so it's added directly rather than through the toggleable theme/layer
  // system. interactive: false means Leaflet never attaches pointer
  // events to it at all: no popup, no click-swallowing, so clicking
  // inside the boundary (including to place a feedback marker) reaches
  // the map and whatever's actually underneath it, same as clicking
  // outside the boundary would.
  fetch("data/little-jamaica-boundary.geojson")
    .then((res) => (res.ok ? res.json() : null))
    .then((geojson) => {
      if (!geojson) return;
      // Community in Public brand orange (#f37721), matching --accent in
      // css/style.css (light mode) — Leaflet's SVG renderer sets this as a
      // presentation attribute, not a CSS property, so a var() reference
      // wouldn't reliably resolve here.
      L.geoJSON(geojson, {
        interactive: false,
        style: () => ({
          color: "#f37721",
          weight: 2,
          dashArray: "6 4",
          fill: true,
          fillOpacity: 0.04,
        }),
      }).addTo(map);
    })
    .catch(() => {
      // Boundary is a nice-to-have overlay — if it's missing or fails to
      // load, the map still works fine without it.
    });

  // ---------- Property boundaries (optional reference overlay) ----------
  // City parcel/lot lines — a heavy layer (~19k polygons), so it's lazily
  // loaded the first time it's switched on and drawn with a canvas
  // renderer, which handles this many shapes far faster than the default
  // SVG one. Non-interactive: it's a visual reference, so clicks pass
  // straight through to place a marker or hit the shape underneath.
  (function setupPropertyBoundaries() {
    const checkbox = document.getElementById("toggle-property-boundaries");
    const statusEl = document.getElementById("reference-status");
    if (!checkbox) return;
    let layer = null;
    const renderer = L.canvas ? L.canvas({ padding: 0.5 }) : undefined;

    checkbox.addEventListener("change", async () => {
      if (!checkbox.checked) {
        if (layer) map.removeLayer(layer);
        return;
      }
      if (layer) {
        layer.addTo(map);
        return;
      }
      checkbox.disabled = true;
      statusEl.textContent = "Loading property boundaries…";
      try {
        const res = await fetch("data/property-boundaries.geojson");
        if (!res.ok) throw new Error("not found");
        const geojson = await res.json();
        layer = L.geoJSON(geojson, {
          renderer,
          interactive: false,
          style: () => ({
            color: "#8b8898",
            weight: 0.7,
            opacity: 0.6,
            fill: false,
          }),
        });
        // The user may have unchecked it while it loaded — only add if
        // still on.
        if (checkbox.checked) layer.addTo(map);
        statusEl.textContent = "";
      } catch {
        checkbox.checked = false;
        statusEl.textContent = "Couldn't load property boundaries.";
      } finally {
        checkbox.disabled = false;
      }
    });
  })();

  // Address search (OpenStreetMap Nominatim geocoding, no API key needed).
  // Guarded in case the CDN script fails to load — the map still works
  // without it.
  let searchResultMarker = null;
  if (window.L.Control && window.L.Control.Geocoder) {
    L.Control.geocoder({
      placeholder: "Enter an address",
      collapsed: false,
      position: "topleft",
      defaultMarkGeocode: false,
    })
      .on("markgeocode", (e) => {
        const { center, name } = e.geocode;
        map.setView(center, 17);

        if (searchResultMarker) map.removeLayer(searchResultMarker);

        const searchedName =
          name || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;

        searchResultMarker = L.marker(center, {
          icon: searchResultIcon(),
          zIndexOffset: 1000,
        }).addTo(map);
        searchResultMarker.bindPopup(`
          <div class="feature-popup">
            <p class="feature-popup__layer">${escapeHtml(searchedName)}</p>
            <button type="button" class="btn btn--small search-feedback-btn">Leave feedback here</button>
          </div>
        `);
        searchResultMarker.on("popupopen", (ev) => {
          ev.popup
            .getElement()
            .querySelector(".search-feedback-btn")
            ?.addEventListener("click", () => {
              searchResultMarker.closePopup();
              openMapCommentDialog({
                lat: center.lat,
                lng: center.lng,
                address: searchedName,
              });
            });
        });
        searchResultMarker.openPopup();
      })
      .addTo(map);
  }

  function searchResultIcon() {
    return L.divIcon({
      className: "search-marker-wrapper",
      html: `<span class="search-marker"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
  }

  // View controls: fullscreen + share, grouped into one connected bar
  // (rather than two separate floating squares) since they're both
  // "adjust how you're viewing the map" actions, distinct from search
  // (finding a place) and from adding feedback (the map's primary action).
  function toggleMapFullscreen() {
    const el = map.getContainer();
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(
        document
      );
    }
  }
  map.on("fullscreenchange", () => map.invalidateSize());
  document.addEventListener("fullscreenchange", () => map.invalidateSize());

  const ViewControls = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control leaflet-control-custom map-controls-group"
      );

      const helpBtn = L.DomUtil.create("a", "", container);
      helpBtn.href = "#";
      helpBtn.title = "How this works";
      helpBtn.setAttribute("role", "button");
      helpBtn.setAttribute(
        "aria-label",
        "How this works — help and moderation info"
      );
      helpBtn.innerHTML = svgIcon("help");
      L.DomEvent.on(helpBtn, "click", L.DomEvent.stop).on(helpBtn, "click", () =>
        document.getElementById("help-dialog").showModal()
      );

      const fullscreenBtn = L.DomUtil.create("a", "", container);
      fullscreenBtn.href = "#";
      fullscreenBtn.title = "Toggle fullscreen";
      fullscreenBtn.setAttribute("role", "button");
      fullscreenBtn.setAttribute("aria-label", "Toggle fullscreen map");
      fullscreenBtn.innerHTML = svgIcon("expand");
      L.DomEvent.on(fullscreenBtn, "click", L.DomEvent.stop).on(
        fullscreenBtn,
        "click",
        () => toggleMapFullscreen()
      );

      const shareBtn = L.DomUtil.create("a", "", container);
      shareBtn.href = "#";
      shareBtn.title = "Copy link to this map";
      shareBtn.setAttribute("role", "button");
      shareBtn.setAttribute("aria-label", "Copy link to this map");
      shareBtn.innerHTML = svgIcon("link");
      L.DomEvent.on(shareBtn, "click", L.DomEvent.stop).on(
        shareBtn,
        "click",
        async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            shareBtn.innerHTML = svgIcon("check");
            setTimeout(() => {
              shareBtn.innerHTML = svgIcon("link");
            }, 1500);
          } catch {
            // Clipboard API may be unavailable (e.g. insecure context) —
            // fail silently, the button just won't confirm the copy.
          }
        }
      );

      return container;
    },
  });
  map.addControl(new ViewControls());

  // Add-marker CTA: the map's single primary action, so it gets its own
  // labeled floating button (bottom-right, easy thumb reach on mobile)
  // rather than living as an icon-only control in the utility stack —
  // click it to arm "placing" mode (cursor becomes a crosshair), then
  // click anywhere on the map to leave a feedback marker there. Plain map
  // clicks do nothing on their own — this makes leaving feedback a
  // deliberate action instead of firing on every click while panning.
  let addMarkerMode = false;
  function addMarkerButtonContent(active) {
    const icon = active ? svgIcon("close", 18) : svgIcon("pin", 18);
    const label = active ? "Cancel adding a marker" : "Add feedback marker";
    return `<span class="map-add-marker-cta__icon" aria-hidden="true">${icon}</span><span class="map-add-marker-cta__label">${label}</span>`;
  }
  const AddMarkerControl = L.Control.extend({
    options: { position: "bottomright" },
    onAdd: function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-control map-add-marker-cta"
      );
      const button = L.DomUtil.create(
        "a",
        "map-add-marker-cta__button",
        container
      );
      button.href = "#";
      button.title = "Add a feedback marker";
      button.setAttribute("role", "button");
      button.setAttribute(
        "aria-label",
        "Add a feedback marker — click, then click the map"
      );
      button.innerHTML = addMarkerButtonContent(false);
      L.DomEvent.on(button, "click", L.DomEvent.stop).on(button, "click", () =>
        setAddMarkerMode(!addMarkerMode)
      );
      this._button = button;
      return container;
    },
  });
  const addMarkerControl = new AddMarkerControl();
  map.addControl(addMarkerControl);

  function setAddMarkerMode(active) {
    if (!config.themes || config.themes.length === 0) {
      return;
    }
    addMarkerMode = active;
    map.getContainer().classList.toggle("add-marker-mode", active);
    const button = addMarkerControl._button;
    button.classList.toggle("is-active", active);
    button.innerHTML = addMarkerButtonContent(active);
    button.title = active ? "Cancel adding a marker" : "Add a feedback marker";
    // The crosshair cursor is the only other "you're placing a marker" cue,
    // and touch devices have no cursor — so this instruction is the whole
    // signal there. Shown while armed, cleared when a marker is placed or
    // the mode is cancelled.
    if (active) {
      const touch = window.matchMedia("(hover: none)").matches;
      showMapToast(
        touch
          ? "Tap the map where you'd like to leave your entry"
          : "Click the map where you'd like to leave your entry"
      );
    } else {
      hideMapToast();
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && addMarkerMode) setAddMarkerMode(false);
  });

  // ---------- Map comments (click-anywhere feedback, threaded by address) ----------
  // Placing a marker (armed via the button above) reverse-geocodes the
  // clicked point to an address (OpenStreetMap Nominatim, same free
  // service the address search box uses) and opens a dialog scoped to
  // that address: everyone who leaves feedback at the same address lands
  // in the same thread and can see + vote on each other's comments,
  // rather than each click creating an isolated pin. One marker is shown
  // per unique address (not per comment) — square, a shape not used by
  // any open data layer, so a resident's own feedback is never confused
  // with official City data.
  const topicsById = new Map((config.themes || []).map((t) => [t.id, t]));
  const sentimentsById = new Map(
    (config.feedbackTypes || []).map((s) => [s.id, s])
  );
  const commentTopicsListEl = document.getElementById("comment-topics-list");
  const markersByLocationKey = new Map();
  let pendingCommentLocation = null;
  // A location marker is shown when BOTH its category checkbox is on and
  // it matches the active feedback-type filter (e.g. "Displaced / gone").
  // A marker aggregates a whole thread, so it carries the set of every
  // sentiment posted at that location and matches if any of them do.
  let sentimentFilter = "all";

  function markerMatchesFilters(entry) {
    const cb = commentTopicsListEl.querySelector(
      `input[data-topic-id="${entry.topicId}"]`
    );
    const topicOn = !cb || cb.checked;
    const typeOn =
      sentimentFilter === "all" || entry.sentiments.has(sentimentFilter);
    return topicOn && typeOn;
  }
  function applyMarkerVisibility(entry) {
    if (markerMatchesFilters(entry)) entry.marker.addTo(map);
    else map.removeLayer(entry.marker);
  }
  function applyAllMarkerVisibility() {
    markersByLocationKey.forEach(applyMarkerVisibility);
  }

  (config.themes || []).forEach((topic) => {
    const li = document.createElement("li");
    li.className = "layers-list__item";
    li.innerHTML = `
      <label>
        <input type="checkbox" data-topic-id="${escapeHtml(topic.id)}" checked />
        <span class="layers-list__swatch" style="background:${escapeHtml(
          topic.color
        )}"></span>
        ${escapeHtml(topic.label)}
      </label>
    `;
    li.querySelector("input").addEventListener("change", () => {
      markersByLocationKey.forEach((entry) => {
        if (entry.topicId === topic.id) applyMarkerVisibility(entry);
      });
    });
    commentTopicsListEl.appendChild(li);
  });

  // Community feedback markers show that comment's category pictogram —
  // the same emoji as the "Community feedback" checkboxes and the
  // Map layers legend — on a colored badge, so a resident's own feedback
  // reads as "what topic is this" at a glance, distinct from the plain
  // circle/diamond/triangle shapes open data layers use. To be replaced
  // later with purpose-drawn icons that stay legible at every zoom level;
  // emoji are a placeholder for that, not the final look.
  function commentMarkerIcon(theme) {
    const inner = ICON_PATHS[theme.id] ? svgIcon(theme.id, 15) : svgIcon("pin", 15);
    return L.divIcon({
      className: "glyph-marker-wrapper",
      html: `<span class="glyph-marker" style="background:${escapeHtml(
        theme.color
      )}">${inner}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    });
  }

  function locationKey(address, lat, lng) {
    return address || `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }

  // First comment at an address sets the marker's color/position; later
  // comments at the same address join its thread without moving or
  // recoloring the marker.
  function ensureLocationMarker(lat, lng, address, topicId, sentimentId) {
    const key = locationKey(address, lat, lng);
    let entry = markersByLocationKey.get(key);
    if (entry) {
      if (sentimentId) entry.sentiments.add(sentimentId);
      applyMarkerVisibility(entry);
      return entry;
    }

    const topic = topicsById.get(topicId);
    const marker = L.marker([lat, lng], {
      icon: commentMarkerIcon(topic || { color: "#898781" }),
    });
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openMapCommentDialog({ lat, lng, address });
    });

    entry = {
      marker,
      topicId,
      sentiments: new Set(sentimentId ? [sentimentId] : []),
    };
    markersByLocationKey.set(key, entry);
    applyMarkerVisibility(entry);
    return entry;
  }

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.display_name ? data.display_name : null;
    } catch {
      return null;
    }
  }

  // Pan+zoom the map so a given point sits at the centre, without zooming
  // back out if the user is already closer in. Used when jumping to an
  // item from the activity feed.
  function focusMap(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
  }

  // Only http(s) links are shown as photo previews — guards against a
  // stored javascript:/data: value ever reaching an <img src> or an href.
  function isHttpUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Small thumbnail for the browse list (inside a <button>, so no link).
  function photoThumbHtml(url) {
    if (!isHttpUrl(url)) return "";
    return `<img class="feedback-entry__photo" src="${escapeHtml(
      url
    )}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`;
  }

  // Larger preview for a thread card, linked to the full photo in a new tab.
  // onerror removes the whole figure so a dead link shows nothing, not a
  // broken-image icon.
  function photoLinkHtml(url) {
    if (!isHttpUrl(url)) return "";
    const s = escapeHtml(url);
    return `<a class="idea-card__photo" href="${s}" target="_blank" rel="noopener noreferrer"><img src="${s}" alt="Photo of this place" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.idea-card__photo').remove()" /></a>`;
  }

  let allMapComments = [];

  async function loadMapComments() {
    if (!db) return;
    const { data, error } = await db
      .from("map_comments")
      .select(
        "id, lat, lng, address, topic, sentiment, year_last_there, comment, name, photo_url, created_at"
      )
      .order("created_at", { ascending: false });
    if (error || !data) return;
    // contact is deliberately never selected here — it stays out of the
    // public browser entirely, only reachable from the admin reporting view.
    allMapComments = data;
    // Markers register oldest-first, so the first comment at an address
    // still sets that location's marker color/position; sentiments from
    // every later comment there accumulate onto the same marker.
    data
      .slice()
      .reverse()
      .forEach((row) =>
        ensureLocationMarker(
          row.lat,
          row.lng,
          row.address || null,
          row.topic,
          row.sentiment
        )
      );
    renderFeedbackEntries();
  }

  // ---------- Feedback-type filter + browsable entry list ----------
  // Lets residents read others' entries without hunting pins, and — via
  // the same filter — view a single type (e.g. displaced places) as its
  // own map: picking a chip both filters this list and hides every marker
  // that doesn't match, so "Displaced / gone" becomes a memory map.
  const feedbackFilterEl = document.getElementById("feedback-filter");
  const feedbackEntriesListEl = document.getElementById(
    "feedback-entries-list"
  );
  const feedbackEntriesMoreBtn = document.getElementById(
    "feedback-entries-more"
  );
  const FEEDBACK_ENTRIES_PAGE_SIZE = 6;
  let feedbackEntriesShown = FEEDBACK_ENTRIES_PAGE_SIZE;

  function buildFeedbackFilter() {
    if (!feedbackFilterEl) return;
    const chips = [{ id: "all", shortLabel: "All" }].concat(
      config.feedbackTypes || []
    );
    feedbackFilterEl.innerHTML = "";
    chips.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (c.id === sentimentFilter ? " is-active" : "");
      btn.dataset.type = c.id;
      btn.textContent = c.shortLabel || c.label;
      btn.addEventListener("click", () => setSentimentFilter(c.id));
      feedbackFilterEl.appendChild(btn);
    });
  }

  function setSentimentFilter(type) {
    sentimentFilter = type;
    if (feedbackFilterEl) {
      feedbackFilterEl.querySelectorAll(".chip").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.type === type);
      });
    }
    feedbackEntriesShown = FEEDBACK_ENTRIES_PAGE_SIZE;
    applyAllMarkerVisibility();
    renderFeedbackEntries();
  }

  function renderFeedbackEntries() {
    if (!feedbackEntriesListEl) return;
    const filtered = allMapComments.filter(
      (c) => sentimentFilter === "all" || c.sentiment === sentimentFilter
    );
    if (!filtered.length) {
      feedbackEntriesListEl.innerHTML = `<li class="empty-msg">${
        allMapComments.length
          ? "No entries of this type yet."
          : "No feedback entries yet — be the first!"
      }</li>`;
      if (feedbackEntriesMoreBtn) feedbackEntriesMoreBtn.hidden = true;
      return;
    }

    const shown = filtered.slice(0, feedbackEntriesShown);
    feedbackEntriesListEl.innerHTML = shown
      .map((c, i) => {
        const topic = topicsById.get(c.topic);
        const type = sentimentsById.get(c.sentiment);
        const metaBits = [
          c.address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
          c.year_last_there ? `Last there ${c.year_last_there}` : null,
          c.name || null,
          formatDate(c.created_at),
        ].filter(Boolean);
        return `
          <li>
            <button type="button" class="feedback-entry" data-idx="${i}"${
          topic ? ` style="--cat:${topic.color}"` : ""
        }>
              <span class="feedback-entry__head">
                <span class="feedback-entry__topic" style="color:${escapeHtml(
                  topic ? topic.color : "inherit"
                )}">${escapeHtml(topic ? topic.label : c.topic)}</span>
                ${
                  type
                    ? `<span class="feedback-entry__type">${escapeHtml(
                        type.shortLabel || type.label
                      )}</span>`
                    : ""
                }
              </span>
              <span class="feedback-entry__text">${escapeHtml(
                c.comment || ""
              )}</span>
              ${photoThumbHtml(c.photo_url)}
              <span class="feedback-entry__meta">${escapeHtml(
                metaBits.join(" · ")
              )}</span>
            </button>
          </li>`;
      })
      .join("");

    feedbackEntriesListEl.querySelectorAll(".feedback-entry").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = shown[Number(btn.dataset.idx)];
        if (c) {
          openMapCommentDialog({
            lat: c.lat,
            lng: c.lng,
            address: c.address || undefined,
          });
        }
      });
    });

    if (feedbackEntriesMoreBtn) {
      feedbackEntriesMoreBtn.hidden = feedbackEntriesShown >= filtered.length;
    }
  }

  if (feedbackEntriesMoreBtn) {
    feedbackEntriesMoreBtn.addEventListener("click", () => {
      feedbackEntriesShown += FEEDBACK_ENTRIES_PAGE_SIZE;
      renderFeedbackEntries();
    });
  }

  buildFeedbackFilter();
  loadMapComments();

  // On small screens the two reference panels (Map layers, Community
  // feedback) otherwise push the map and everything else into a long
  // scroll — collapse them by default there so the map leads, one tap
  // from being reopened. They stay open on wider screens.
  if (window.matchMedia("(max-width: 640px)").matches) {
    document
      .querySelectorAll("details.layers-panel[data-collapsible]")
      .forEach((d) => {
        d.open = false;
      });
  }

  // Aggregate count of feedback per topic across the whole map — the
  // click-anywhere-feedback analog of the per-site results bar chart.
  // Bars use each topic's own color (already its identity everywhere
  // else on the page: swatch, marker) rather than one neutral hue.
  async function loadTopicSummary() {
    const chartEl = document.getElementById("topic-summary-chart");
    const topics = config.themes || [];
    if (topics.length === 0) {
      chartEl.innerHTML = "";
      return;
    }
    if (!db) {
      chartEl.innerHTML = `<p class="empty-msg">Backend not configured — see README.md.</p>`;
      return;
    }
    chartEl.innerHTML = `<p class="empty-msg">Loading…</p>`;

    const { data, error } = await db.from("map_comments").select("topic");
    if (error) {
      chartEl.innerHTML = `<p class="empty-msg">Couldn't load topic summary: ${escapeHtml(
        error.message
      )}</p>`;
      return;
    }
    if (!data.length) {
      chartEl.innerHTML = `<p class="empty-msg">No feedback submitted yet.</p>`;
      return;
    }

    const counts = new Map(topics.map((t) => [t.id, 0]));
    data.forEach((row) => {
      if (counts.has(row.topic)) {
        counts.set(row.topic, counts.get(row.topic) + 1);
      }
    });

    const results = topics
      .map((t) => ({
        label: t.label,
        color: t.color,
        count: counts.get(t.id) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...results.map((r) => r.count), 1);

    chartEl.innerHTML = "";
    results.forEach((r) => {
      const pct = Math.max((r.count / maxCount) * 100, 1);
      const row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML = `
        <span class="result-row__label">${escapeHtml(r.label)}</span>
        <span class="result-row__track">
          <span class="result-row__bar" style="width:${pct}%;background:${escapeHtml(
            r.color
          )}"></span>
        </span>
        <span class="result-row__value">${r.count}</span>
      `;
      chartEl.appendChild(row);
    });
  }
  loadTopicSummary();

  // Live activity feed — a running list of click-anywhere feedback,
  // newest first. Fetches a batch up front rather than paging the database
  // directly; "Load more" just reveals more of what's already in memory.
  const ACTIVITY_FEED_FETCH_LIMIT = 40;
  const ACTIVITY_FEED_PAGE_SIZE = 8;
  let activityItems = [];
  let activityRenderCount = 0;

  async function loadActivityFeed() {
    const listEl = document.getElementById("activity-feed-list");
    const moreBtn = document.getElementById("activity-feed-more");
    if (!db) {
      listEl.innerHTML = `<li class="empty-msg">Backend not configured — see README.md.</li>`;
      moreBtn.hidden = true;
      return;
    }

    const { data } = await db
      .from("map_comments")
      .select("id, topic, lat, lng, address, created_at")
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_FEED_FETCH_LIMIT);

    activityItems = (data || []).map((c) => ({
      created_at: c.created_at,
      topic: topicsById.get(c.topic) || null,
      lat: c.lat,
      lng: c.lng,
      address: c.address,
    }));
    activityRenderCount = 0;

    if (!activityItems.length) {
      listEl.innerHTML = `<li class="empty-msg">No activity yet.</li>`;
      moreBtn.hidden = true;
      return;
    }
    renderActivityFeed();
  }

  function renderActivityFeed() {
    const listEl = document.getElementById("activity-feed-list");
    const moreBtn = document.getElementById("activity-feed-more");
    activityRenderCount = Math.min(
      activityRenderCount + ACTIVITY_FEED_PAGE_SIZE,
      activityItems.length
    );

    listEl.innerHTML = "";
    activityItems.slice(0, activityRenderCount).forEach((item) => {
      const color = item.topic ? item.topic.color : null;
      const label = `A ${
        item.topic ? item.topic.label : "feedback"
      } marker was added`;

      const li = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "activity-item activity-item--clickable";
      row.innerHTML = `
        <span class="activity-item__dot" style="background:${escapeHtml(
          color || "var(--text-muted)"
        )}"></span>
        <span class="activity-item__text">${escapeHtml(label)}</span>
        <span class="activity-item__time">${formatRelativeTime(
          item.created_at
        )}</span>
      `;
      row.addEventListener("click", () => {
        focusMap(item.lat, item.lng);
        openMapCommentDialog({
          lat: item.lat,
          lng: item.lng,
          address: item.address,
        });
      });
      li.appendChild(row);
      listEl.appendChild(li);
    });

    moreBtn.hidden = activityRenderCount >= activityItems.length;
  }

  document
    .getElementById("activity-feed-more")
    .addEventListener("click", renderActivityFeed);

  loadActivityFeed();

  const mapCommentDialog = document.getElementById("map-comment-dialog");
  const mapCommentPanel = document.getElementById("map-comment-panel");
  const mapCommentContent = document.getElementById("map-comment-content");
  const mapCommentTopicSelect = document.getElementById("map-comment-topic");
  (config.themes || []).forEach((topic) => {
    const opt = document.createElement("option");
    opt.value = topic.id;
    opt.textContent = topic.label;
    mapCommentTopicSelect.appendChild(opt);
  });

  const mapCommentSentimentSelect = document.getElementById(
    "map-comment-sentiment"
  );
  (config.feedbackTypes || []).forEach((sentiment) => {
    const opt = document.createElement("option");
    opt.value = sentiment.id;
    opt.textContent = sentiment.label;
    mapCommentSentimentSelect.appendChild(opt);
  });

  // A nudge, not a required field — e.g. "losing" encourages naming the
  // place and linking a photo, without needing dedicated form fields for
  // just that one option.
  const mapCommentSentimentHint = document.getElementById(
    "map-comment-sentiment-hint"
  );
  const mapCommentYearField = document.getElementById(
    "map-comment-year-field"
  );
  mapCommentSentimentSelect.addEventListener("change", () => {
    const type = sentimentsById.get(mapCommentSentimentSelect.value);
    mapCommentSentimentHint.textContent = type?.hint || "";
    mapCommentSentimentHint.hidden = !type?.hint;
    mapCommentYearField.hidden = !type?.askYear;
  });

  // Short/new threads open in the centered dialog, unchanged. A thread
  // that already has 1+ comments opens in the slide-out panel instead, so
  // the list gets its own scroll region and the compose form stays
  // reachable instead of both competing for one fixed-height box. Which
  // one to use can only be known after checking for existing comments —
  // feedback can start from an existing comment marker, from a brand new
  // map click, or from clicking a City open-data feature that may or may
  // not already have feedback on it — so the check runs every time.
  let panelFocusReturnTo = null;

  function closeMapCommentPanel() {
    mapCommentPanel.classList.remove("is-open");
    if (panelFocusReturnTo && typeof panelFocusReturnTo.focus === "function") {
      panelFocusReturnTo.focus();
    }
    panelFocusReturnTo = null;
  }
  document
    .getElementById("map-comment-panel-close")
    .addEventListener("click", closeMapCommentPanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mapCommentPanel.classList.contains("is-open")) {
      closeMapCommentPanel();
    }
  });

  async function openMapCommentDialog({ lat, lng, address, presetTopic }) {
    pendingCommentLocation = { lat, lng, address: address || null };
    // Reset topic to the unselected placeholder each open (unless a shape's
    // category preset it), so a leftover choice can't be filed silently —
    // it's required, same as the feedback type below.
    mapCommentTopicSelect.value = presetTopic || "";
    document.getElementById("map-comment-text").value = "";
    // Reset to the unselected placeholder each time, so a sentiment
    // chosen for a previous comment can't be silently reused for this
    // one — it's required, and each comment should get a deliberate
    // choice.
    mapCommentSentimentSelect.value = "";
    mapCommentSentimentHint.hidden = true;
    mapCommentYearField.hidden = true;
    document.getElementById("map-comment-year").value = "";
    // Photo is about this specific place, so it's cleared each time (like
    // the comment and year). Name/contact are deliberately NOT reset —
    // if someone leaves feedback at several spots in one visit, they
    // shouldn't have to retype who they are each time.
    document.getElementById("map-comment-photo").value = "";
    const statusEl = document.getElementById("map-comment-status");
    statusEl.textContent = "";
    statusEl.className = "status-msg";

    document.body.classList.add("feedback-loading");

    let resolvedAddress = address || null;
    if (!resolvedAddress) {
      resolvedAddress = await reverseGeocode(lat, lng);
      // The lookup may finish after the dialog was reopened for somewhere
      // else — only apply it if still relevant.
      if (pendingCommentLocation && pendingCommentLocation.lat === lat) {
        pendingCommentLocation.address = resolvedAddress;
      }
    }

    let comments = [];
    let votesByComment = new Map();
    let error = null;
    if (db) {
      const result = await fetchCommentThread(resolvedAddress, lat, lng);
      comments = result.comments || [];
      votesByComment = result.votesByComment || new Map();
      error = result.error || null;
    }

    document.body.classList.remove("feedback-loading");

    document.getElementById("map-comment-address").textContent =
      resolvedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    renderCommentThread(comments, votesByComment, resolvedAddress, lat, lng, error);
    mapCommentContent.hidden = false;

    if (comments.length >= 1) {
      if (mapCommentDialog.open) mapCommentDialog.close();
      mapCommentPanel.appendChild(mapCommentContent);
      panelFocusReturnTo = document.activeElement;
      mapCommentPanel.classList.add("is-open");
      document.getElementById("map-comment-panel-close").focus();
    } else {
      mapCommentPanel.classList.remove("is-open");
      mapCommentDialog.appendChild(mapCommentContent);
      if (!mapCommentDialog.open) mapCommentDialog.showModal();
    }
  }

  async function fetchCommentThread(address, lat, lng) {
    let query = db
      .from("map_comments")
      .select(
        "id, topic, sentiment, year_last_there, comment, name, photo_url, created_at"
      );
    query = address
      ? query.eq("address", address)
      : query.eq("lat", lat).eq("lng", lng);
    const { data: comments, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) return { comments: null, votesByComment: null, error };
    if (!comments.length) return { comments: [], votesByComment: new Map() };

    const commentIds = comments.map((c) => c.id);
    const { data: votes } = await db
      .from("map_comment_votes")
      .select("comment_id, voter_token, direction")
      .in("comment_id", commentIds);

    const votesByComment = new Map();
    (votes || []).forEach((v) => {
      if (!votesByComment.has(v.comment_id)) {
        votesByComment.set(v.comment_id, []);
      }
      votesByComment.get(v.comment_id).push(v);
    });

    return { comments, votesByComment };
  }

  function renderCommentThread(comments, votesByComment, address, lat, lng, error) {
    const listEl = document.getElementById("map-comment-thread-list");
    if (error) {
      listEl.innerHTML = `<li class="empty-msg">Couldn't load idea/archive entries: ${escapeHtml(
        error.message
      )}</li>`;
      return;
    }
    if (!comments.length) {
      listEl.innerHTML = `<li class="empty-msg">No idea/archive entries yet at this location — be the first!</li>`;
      return;
    }

    listEl.innerHTML = "";
    comments.forEach((c) => {
      const topic = topicsById.get(c.topic);
      const sentiment = sentimentsById.get(c.sentiment);
      const cVotes = votesByComment.get(c.id) || [];
      const upCount = cVotes.filter((v) => v.direction === 1).length;
      const downCount = cVotes.filter((v) => v.direction === -1).length;
      const myVote = cVotes.find((v) => v.voter_token === voterToken);

      const li = document.createElement("li");
      li.className = "idea-card";
      if (topic) li.style.setProperty("--cat", topic.color);
      li.innerHTML = `
        <div class="idea-card__top">
          <span class="idea-card__author" style="color:${escapeHtml(
            topic ? topic.color : "inherit"
          )}">${escapeHtml(topic ? topic.label : c.topic)}</span>
          <span class="idea-card__time">${formatDate(c.created_at)}${
        c.name ? ` · ${escapeHtml(c.name)}` : ""
      }</span>
        </div>
        ${
          sentiment
            ? `<span class="idea-card__sentiment">${escapeHtml(
                sentiment.label
              )}${
                c.year_last_there
                  ? ` · Last there in ${escapeHtml(String(c.year_last_there))}`
                  : ""
              }</span>`
            : ""
        }
        <p class="idea-card__comment">${escapeHtml(c.comment)}</p>
        ${photoLinkHtml(c.photo_url)}
        <div class="vote-btns">
          <button type="button" class="upvote-btn${
            myVote?.direction === 1 ? " is-active" : ""
          }" data-dir="1">▲ ${upCount}</button>
          <button type="button" class="upvote-btn upvote-btn--down${
            myVote?.direction === -1 ? " is-active" : ""
          }" data-dir="-1">▼ ${downCount}</button>
        </div>
      `;
      li.querySelectorAll(".upvote-btn").forEach((btn) => {
        btn.addEventListener("click", () =>
          toggleCommentVote(
            c.id,
            Number(btn.dataset.dir),
            myVote,
            address,
            lat,
            lng
          )
        );
      });
      listEl.appendChild(li);
    });
  }

  async function refreshCommentThread(address, lat, lng) {
    if (!db) return;
    const { comments, votesByComment, error } = await fetchCommentThread(
      address,
      lat,
      lng
    );
    renderCommentThread(
      comments || [],
      votesByComment || new Map(),
      address,
      lat,
      lng,
      error
    );
  }

  async function toggleCommentVote(commentId, direction, myVote, address, lat, lng) {
    if (!db) return;
    if (myVote) {
      await db
        .from("map_comment_votes")
        .delete()
        .eq("comment_id", commentId)
        .eq("voter_token", voterToken);
    }
    if (!myVote || myVote.direction !== direction) {
      await db
        .from("map_comment_votes")
        .insert({ comment_id: commentId, voter_token: voterToken, direction });
    }
    refreshCommentThread(address, lat, lng);
  }

  map.on("click", (e) => {
    if (!addMarkerMode) return;
    setAddMarkerMode(false);
    openMapCommentDialog({ lat: e.latlng.lat, lng: e.latlng.lng });
  });

  document
    .getElementById("submit-map-comment")
    .addEventListener("click", async () => {
      const statusEl = document.getElementById("map-comment-status");
      if (!db) {
        statusEl.textContent =
          "Backend not configured — see README.md to enable saving.";
        statusEl.className = "status-msg is-error";
        return;
      }
      if (!pendingCommentLocation) return;
      const comment = document
        .getElementById("map-comment-text")
        .value.trim();
      if (!comment) {
        statusEl.textContent =
          "Please add an idea/archive entry before submitting.";
        statusEl.className = "status-msg is-error";
        return;
      }
      const sentiment = mapCommentSentimentSelect.value;
      if (!sentiment) {
        statusEl.textContent =
          "Please choose what type of feedback this is.";
        statusEl.className = "status-msg is-error";
        return;
      }
      const topic = mapCommentTopicSelect.value;
      if (!topic) {
        statusEl.textContent = "Please choose a topic for your entry.";
        statusEl.className = "status-msg is-error";
        return;
      }

      const name = document.getElementById("map-comment-name").value.trim();
      const contact = document
        .getElementById("map-comment-contact")
        .value.trim();
      const yearRaw = document.getElementById("map-comment-year").value.trim();
      const year = yearRaw ? Number(yearRaw) : null;
      const photoUrl = document
        .getElementById("map-comment-photo")
        .value.trim();
      if (photoUrl && !isHttpUrl(photoUrl)) {
        statusEl.textContent =
          "Please enter a valid photo link starting with http:// or https://";
        statusEl.className = "status-msg is-error";
        return;
      }

      const submitBtn = document.getElementById("submit-map-comment");
      submitBtn.disabled = true;
      statusEl.textContent = "Submitting…";
      statusEl.className = "status-msg";

      const { lat, lng, address } = pendingCommentLocation;
      const row = {
        lat,
        lng,
        address,
        topic,
        sentiment,
        year_last_there: year,
        comment,
        name: name || null,
        contact: contact || null,
        photo_url: photoUrl || null,
        voter_token: voterToken,
      };
      const { error } = await db.from("map_comments").insert(row);

      submitBtn.disabled = false;
      if (error) {
        statusEl.textContent = `Something went wrong: ${error.message}`;
        statusEl.className = "status-msg is-error";
        return;
      }
      statusEl.textContent = "Thanks! Your feedback was submitted.";
      statusEl.className = "status-msg is-ok";
      document.getElementById("map-comment-text").value = "";
      document.getElementById("map-comment-year").value = "";
      document.getElementById("map-comment-photo").value = "";
      ensureLocationMarker(lat, lng, address, row.topic, row.sentiment);
      refreshContributionCounter();
      loadTopicSummary();
      loadActivityFeed();
      loadMapComments();
      refreshCommentThread(address, lat, lng);
    });

  // ---------- Open data layers ----------
  // Layer metadata (id/label/theme) comes from data/sources.json; the
  // actual shapes for a layer live in data/<id>.geojson, both generated by
  // scripts/fetch-open-data.js (see README.md). The panel groups layers by
  // theme (one checkbox toggles every dataset in that theme together) —
  // color comes from the theme, not the individual layer, so everything
  // under e.g. "Public Facilities" reads as one family on
  // the map even though it's three separate City datasets. Shapes are
  // fetched lazily, the first time a theme is switched on.
  const layersListEl = document.getElementById("layers-list");
  const layersStatusEl = document.getElementById("layers-status");
  const loadedDataLayers = new Map(); // layer.id -> built L.geoJSON layer
  let popupTemplates = {}; // shared per-layer popup field mappings — see buildFeaturePopup()

  fetch("data/sources.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((sourcesConfig) => {
      if (!sourcesConfig || !Array.isArray(sourcesConfig.layers)) return;
      popupTemplates = sourcesConfig.popupTemplates || {};
      const layersByTheme = new Map();
      sourcesConfig.layers.forEach((layer) => {
        const key = layer.theme;
        if (!layersByTheme.has(key)) layersByTheme.set(key, []);
        layersByTheme.get(key).push(layer);
      });
      // Iterate in taxonomy order so the panel matches "Community
      // feedback" below it; themes with no open data (e.g. Employment)
      // simply don't get a checkbox here.
      (config.themes || []).forEach((theme) => {
        const layers = layersByTheme.get(theme.id);
        if (layers && layers.length) addThemeToggle(theme, layers);
      });
    })
    .catch(() => {
      // Open data layers are optional — if data/sources.json hasn't been
      // generated yet, just show the site without any overlay layers.
    });

  function addThemeToggle(theme, layers) {
    const li = document.createElement("li");
    li.className = "layers-list__item";
    li.innerHTML = `
      <label>
        <input type="checkbox" data-theme-id="${escapeHtml(theme.id)}" />
        <span class="layers-list__swatch" style="background:${escapeHtml(
          theme.color
        )}"></span>
        ${escapeHtml(theme.label)}
      </label>
    `;
    li.querySelector("input").addEventListener("change", (e) =>
      toggleThemeLayers(theme, layers, e.currentTarget)
    );
    layersListEl.appendChild(li);
  }

  async function toggleThemeLayers(theme, layers, checkbox) {
    checkbox.disabled = true;
    layersStatusEl.textContent = "";
    layersStatusEl.classList.remove("layers-status--info");
    try {
      if (checkbox.checked) {
        const emptyLabels = [];
        for (const layer of layers) {
          let geoLayer = loadedDataLayers.get(layer.id);
          if (!geoLayer) {
            const res = await fetch(`data/${layer.id}.geojson`);
            if (!res.ok) {
              throw new Error(
                `data/${layer.id}.geojson not found yet — run scripts/fetch-open-data.js`
              );
            }
            const geojson = await res.json();
            if (!geojson.features || geojson.features.length === 0) {
              emptyLabels.push(layer.label);
            }
            geoLayer = buildGeoJSONLayer(layer, theme, geojson);
            loadedDataLayers.set(layer.id, geoLayer);
          }
          geoLayer.addTo(map);
        }
        if (emptyLabels.length) {
          layersStatusEl.textContent = `${emptyLabels.join(
            ", "
          )} — no shapes in this area.`;
          layersStatusEl.classList.add("layers-status--info");
        }
      } else {
        layers.forEach((layer) => {
          const geoLayer = loadedDataLayers.get(layer.id);
          if (geoLayer) map.removeLayer(geoLayer);
        });
      }
    } catch (err) {
      checkbox.checked = false;
      layersStatusEl.textContent = `Couldn't load "${theme.label}": ${err.message}`;
    } finally {
      checkbox.disabled = false;
    }
  }

  function buildGeoJSONLayer(layer, theme, geojson) {
    const color = theme.color;
    return L.geoJSON(geojson, {
      style: () => ({
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        dashArray: layer.dashed ? "6 4" : null,
      }),
      pointToLayer: (feature, latlng) => {
        if (layer.shape === "diamond") {
          return L.marker(latlng, { icon: diamondIcon(color) });
        }
        if (layer.shape === "triangle") {
          return L.marker(latlng, { icon: triangleIcon(color) });
        }
        return L.circleMarker(latlng, {
          radius: layer.radius || 6,
          color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 2,
        });
      },
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindPopup(
          buildFeaturePopup(layer, theme, feature.properties)
        );
        // Path-based layers (polygons, circleMarkers) bubble clicks to the
        // map by default, which would also open the "leave feedback here"
        // dialog. Stop it so clicking a shape only opens its own popup.
        leafletLayer.on("click", (e) => L.DomEvent.stopPropagation(e));
        leafletLayer.on("popupopen", (e) => {
          e.popup
            .getElement()
            .querySelector(".feature-feedback-btn")
            ?.addEventListener("click", () => {
              leafletLayer.closePopup();
              openFeatureFeedback(layer, theme, feature, leafletLayer);
            });
        });
      },
    });
  }

  function diamondIcon(color) {
    return L.divIcon({
      className: "diamond-marker-wrapper",
      html: `<span class="diamond-marker" style="background:${escapeHtml(
        color
      )}"></span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      popupAnchor: [0, -6],
    });
  }

  function triangleIcon(color) {
    return L.divIcon({
      className: "triangle-marker-wrapper",
      html: `<span class="triangle-marker" style="border-bottom-color:${escapeHtml(
        color
      )}"></span>`,
      iconSize: [14, 12],
      iconAnchor: [7, 10],
      popupAnchor: [0, -10],
    });
  }

  // Datasets use wildly different property naming conventions for
  // addresses — check the common ones before falling back to
  // reverse-geocoding the feature's location. Only used when a layer has
  // no curated addressField of its own (see resolvePopupConfig below).
  const ADDRESS_PROPERTY_CANDIDATES = [
    "ADDRESS_FULL",
    "Address",
    "SOURCE_ADDRESS",
    "AREA_DESC",
    "AREA_NAME",
    "PLACE_NAME",
    "Property Description",
    "Building Description",
    "DEV_NAME",
    "StationName",
    "BranchName",
    "NAME",
  ];

  function extractFeatureAddress(layer, properties) {
    const config = resolvePopupConfig(layer);
    if (config.addressField && !isBlankValue(properties?.[config.addressField])) {
      return String(properties[config.addressField]).trim();
    }
    for (const key of ADDRESS_PROPERTY_CANDIDATES) {
      const value = properties && properties[key];
      if (!isBlankValue(value)) return String(value).trim();
    }
    return null;
  }

  function getFeatureLatLng(leafletLayer) {
    if (typeof leafletLayer.getLatLng === "function") {
      return leafletLayer.getLatLng();
    }
    if (typeof leafletLayer.getBounds === "function") {
      return leafletLayer.getBounds().getCenter();
    }
    return null;
  }

  function openFeatureFeedback(layer, theme, feature, leafletLayer) {
    const latlng = getFeatureLatLng(leafletLayer);
    if (!latlng) return;
    openMapCommentDialog({
      lat: latlng.lat,
      lng: latlng.lng,
      address: extractFeatureAddress(layer, feature.properties) || undefined,
      presetTopic: theme.id,
    });
  }

  // Popups: a curated title/address/up-to-3 details/note by default (see
  // per-layer titleField/addressField/detailFields/noteField/linkField in
  // data/sources.json, or a shared popupTemplate for the many Real Estate
  // Asset Inventory layers that all share one schema), plus the complete
  // raw record behind a "Full record" disclosure for anyone who wants it —
  // nothing from the source data is actually hidden, just not the default
  // view. A layer with no curated title for a given feature (not yet
  // mapped, or blank for this particular record) falls back to the old
  // "dump every field" behaviour entirely.

  // The City's own source files use the literal text "None"/"NULL" as
  // their null placeholder — treat those as blank too, not as real values.
  function isBlankValue(v) {
    if (v === null || v === undefined) return true;
    const s = String(v).trim();
    if (s === "") return true;
    return /^(none|null|n\/a)$/i.test(s);
  }

  function resolvePopupConfig(layer) {
    const base = layer.popupTemplate
      ? popupTemplates[layer.popupTemplate] || {}
      : {};
    return {
      titleField: layer.titleField || base.titleField || null,
      addressField: layer.addressField || base.addressField || null,
      noteField: layer.noteField || base.noteField || null,
      linkField: layer.linkField || base.linkField || null,
      linkLabel: layer.linkLabel || base.linkLabel || "More info",
      detailFields: layer.detailFields || base.detailFields || [],
      ownerHint: layer.ownerHint || base.ownerHint || null,
    };
  }

  // "Who owns/governs this" — deliberately generic, not a specific
  // contact. We can derive ownership from data already in the app
  // (Owner/Jurisdiction/Management on Real Estate Asset Inventory
  // records, or a fixed value for layers that are consistently one kind
  // of owner, like Toronto Community Housing). We do NOT fabricate named
  // staff contacts or emails — only stable, always-correct pointers
  // (311, "your Ward Councillor") plus which body to start with.
  const OWNER_TYPE_META = {
    city: {
      tagLabel: "City of Toronto",
      tagClass: "feature-popup__owner-tag--city",
      note:
        "Start with 311 (toronto.ca/311) and your Ward Councillor. Most changes here go through City Council, not a single department — this is the door, not the decision.",
    },
    city_agency: {
      tagLabel: "City agency",
      tagClass: "feature-popup__owner-tag--agency",
      note:
        "City-owned but run separately from City Hall's usual departments. 311 can help route you if you're not sure who to ask.",
    },
    school_board: {
      tagLabel: "School board",
      tagClass: "feature-popup__owner-tag--school",
      note:
        "School boards set their own rules for community use of their property — contact the board directly, not the City.",
    },
    external: {
      tagLabel: "Not the City — verify",
      tagClass: "feature-popup__owner-tag--verify",
      note:
        "This may look like City land, but it isn't. Writing to the City here likely won't reach the right office — contact this owner directly, and loop in your Ward Councillor.",
    },
    private: {
      tagLabel: "Privately owned",
      tagClass: "feature-popup__owner-tag--private",
      note:
        "This is privately owned. Changes here are up to the owner — there's no City department to petition about it.",
    },
  };

  // A handful of City-owned bodies that operate at arm's length from
  // City Hall's usual departments — worth flagging as their own kind of
  // "city", not lumped in with e.g. Parks or Transportation Services.
  const CITY_AGENCY_KEYWORDS = [
    "toronto parking authority",
    "toronto transit commission",
    "toronto community housing",
    "toronto public library",
  ];

  // Owner values the source data uses as its own generic placeholder —
  // not an actual name, so prefer the more specific Jurisdiction/
  // Management value instead when this is what Owner says.
  const GENERIC_OWNER_LABELS = new Set([
    "third party",
    "third party organization",
    "not-for-profit organization",
  ]);

  function buildOwnershipInfo(layer, properties) {
    const hint = resolvePopupConfig(layer).ownerHint;
    if (!hint) return null;
    const props = properties || {};

    if (hint.mode === "fixed") {
      return { type: hint.type, agency: hint.agency || null };
    }

    if (hint.mode === "field") {
      const agency = props[hint.agencyField];
      if (isBlankValue(agency)) return null;
      return { type: hint.type, agency: String(agency).trim() };
    }

    if (hint.mode === "fields") {
      const ownerRaw = props[hint.ownerField];
      const governingRaw =
        (!isBlankValue(props[hint.jurisdictionField]) &&
          props[hint.jurisdictionField]) ||
        (!isBlankValue(props[hint.managementField]) &&
          props[hint.managementField]) ||
        ownerRaw;
      if (isBlankValue(governingRaw)) return null;

      const ownerTrim = isBlankValue(ownerRaw) ? "" : String(ownerRaw).trim();
      const isCityOwned =
        !ownerTrim || ownerTrim.toLowerCase() === "city of toronto";
      const governingName = String(governingRaw).trim();

      if (!isCityOwned) {
        const displayName = GENERIC_OWNER_LABELS.has(ownerTrim.toLowerCase())
          ? governingName
          : ownerTrim;
        // A named school board isn't a surprise/"verify this" case the
        // way Metrolinx-on-Eglinton is — it's a well-identified owner
        // with its own known process, same as the document's owner_type
        // taxonomy treats it separately from generic external land.
        const isSchoolBoard = /school board/i.test(displayName);
        return {
          type: isSchoolBoard ? "school_board" : "external",
          agency: displayName,
        };
      }

      const isAgency = CITY_AGENCY_KEYWORDS.some((k) =>
        governingName.toLowerCase().includes(k)
      );
      return {
        type: isAgency ? "city_agency" : "city",
        agency: governingName,
      };
    }

    return null;
  }

  function buildOwnershipBlock(layer, properties) {
    const info = buildOwnershipInfo(layer, properties);
    if (!info) return "";
    const meta = OWNER_TYPE_META[info.type];
    if (!meta) return "";
    const agencyLine = info.agency
      ? `<strong>${escapeHtml(toTitleCase(info.agency))}.</strong> `
      : "";
    return `
      <div class="feature-popup__owner">
        <span class="feature-popup__owner-tag ${
          meta.tagClass
        }">${escapeHtml(meta.tagLabel)}</span>
        <p class="feature-popup__owner-body">${agencyLine}${escapeHtml(
      meta.note
    )}</p>
      </div>
    `;
  }

  // Most source fields are ALL CAPS; a handful (screen names, station
  // names) already come pre-formatted. Only touch strings with no
  // lowercase letters at all, so already-correct casing is never altered
  // — and treat an apostrophe as staying inside a word ("George's", not
  // "George'S") while a period still starts a new capitalized token
  // ("C.I.", not "C.i.").
  function toTitleCase(str) {
    const s = String(str).trim();
    if (!s || /[a-z]/.test(s)) return s;
    return s
      .toLowerCase()
      .replace(/(^|[\s\-/.])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
  }

  function formatDetailValue(raw, unit, rawFormat) {
    const s = String(raw).trim();
    // A year ("1964") shouldn't be comma-grouped like a quantity would be
    // ("1,964") — detail fields that are years mark themselves rawFormat.
    const numeric = !rawFormat && /^-?[\d,]+(\.\d+)?$/.test(s);
    const text = numeric ? Number(s.replace(/,/g, "")).toLocaleString() : s;
    return unit ? `${text} ${unit}` : text;
  }

  function buildRawRecordRows(properties) {
    return Object.entries(properties || {})
      .filter(([, v]) => !isBlankValue(v))
      .map(
        ([k, v]) =>
          `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`
      );
  }

  function buildFeaturePopup(layer, theme, properties) {
    const props = properties || {};
    const config = resolvePopupConfig(layer);
    const rawRows = buildRawRecordRows(props);
    const titleRaw = config.titleField ? props[config.titleField] : null;

    if (isBlankValue(titleRaw)) {
      // No curated title for this layer, or this specific record is
      // missing it — fall back to the original "every field" popup
      // rather than showing a blank or misleading curated card.
      return `
        <div class="feature-popup">
          <p class="feature-popup__layer">${escapeHtml(layer.label)}</p>
          <table class="feature-popup__table">${rawRows.slice(0, 12).join("")}</table>
          <button type="button" class="btn btn--small feature-feedback-btn">Leave feedback about this</button>
        </div>
      `;
    }

    const title = toTitleCase(String(titleRaw));
    const address =
      config.addressField && !isBlankValue(props[config.addressField])
        ? toTitleCase(String(props[config.addressField]))
        : null;
    const note =
      config.noteField && !isBlankValue(props[config.noteField])
        ? String(props[config.noteField]).trim()
        : null;
    const chips = config.detailFields
      .map((d) => {
        const raw = props[d.key];
        if (isBlankValue(raw)) return null;
        const value =
          (d.valueMap && d.valueMap[String(raw).trim()]) ||
          formatDetailValue(raw, d.unit, d.raw);
        return { label: d.label, value };
      })
      .filter(Boolean)
      .slice(0, 3);
    const link =
      config.linkField && !isBlankValue(props[config.linkField])
        ? { url: String(props[config.linkField]).trim(), label: config.linkLabel }
        : null;

    return `
      <div class="feature-popup">
        <p class="feature-popup__layer">${escapeHtml(layer.label)}</p>
        <p class="feature-popup__title">${escapeHtml(title)}</p>
        ${address ? `<p class="feature-popup__address">${escapeHtml(address)}</p>` : ""}
        ${note ? `<p class="feature-popup__note">${escapeHtml(note)}</p>` : ""}
        ${
          chips.length
            ? `<div class="feature-popup__chips">${chips
                .map(
                  (c) =>
                    `<span class="feature-popup__chip"><b>${escapeHtml(
                      c.label
                    )}:</b> ${escapeHtml(c.value)}</span>`
                )
                .join("")}</div>`
            : ""
        }
        ${
          link
            ? `<a href="${escapeHtml(
                link.url
              )}" target="_blank" rel="noopener" class="feature-popup__link">${escapeHtml(
                link.label
              )} ↗</a>`
            : ""
        }
        ${buildOwnershipBlock(layer, props)}
        <button type="button" class="btn btn--small feature-feedback-btn">Leave feedback about this</button>
        ${
          rawRows.length
            ? `<details class="feature-popup__details">
                <summary>Full record (${rawRows.length} field${
                rawRows.length === 1 ? "" : "s"
              })</summary>
                <table class="feature-popup__table">${rawRows.join("")}</table>
              </details>`
            : ""
        }
      </div>
    `;
  }

  // ---------- Helpers ----------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  function formatRelativeTime(iso) {
    try {
      const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return "just now";
      const diffMin = Math.round(diffSec / 60);
      if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
      const diffHour = Math.round(diffMin / 60);
      if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
      const diffDay = Math.round(diffHour / 24);
      if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
      const diffMonth = Math.round(diffDay / 30);
      if (diffMonth < 12)
        return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
      const diffYear = Math.round(diffMonth / 12);
      return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
    } catch {
      return "";
    }
  }
})();
