(function () {
  "use strict";

  const config = window.APP_CONFIG;
  const categoriesById = new Map(config.categories.map((c) => [c.id, c]));

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

  // ---------- Page header / intro ----------
  document.getElementById(
    "page-title"
  ).textContent = `${config.neighbourhood.name}: Public Land Use Tool`;
  document.getElementById(
    "page-subtitle"
  ).textContent = `Help decide how public land should be used in ${config.neighbourhood.name}.`;

  // ---------- Contribution counter ----------
  // Counts both site rankings (submissions) and map click-anywhere
  // feedback (map_comments) — anything a resident has contributed.
  async function refreshContributionCounter() {
    const el = document.getElementById("contribution-counter");
    if (!db) return;
    el.textContent = "Loading contributions…";
    el.hidden = false;
    const [submissionsResult, commentsResult] = await Promise.all([
      db.from("submissions").select("*", { count: "exact", head: true }),
      db.from("map_comments").select("*", { count: "exact", head: true }),
    ]);
    if (
      submissionsResult.error ||
      commentsResult.error ||
      submissionsResult.count === null ||
      commentsResult.count === null
    ) {
      el.textContent = "Contribution count unavailable";
      return;
    }
    const total = submissionsResult.count + commentsResult.count;
    el.textContent = `${total.toLocaleString()} contribution${
      total === 1 ? "" : "s"
    } so far`;
  }
  refreshContributionCounter();

  // ---------- Map ----------
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
      // Matches --accent in css/style.css (light mode) — Leaflet's SVG
      // renderer sets this as a presentation attribute, not a CSS
      // property, so a var() reference wouldn't reliably resolve here.
      L.geoJSON(geojson, {
        interactive: false,
        style: () => ({
          color: "#c24e1d",
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

        const searchedSite = {
          id: `search-${center.lat.toFixed(5)}-${center.lng.toFixed(5)}`,
          name: name || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
          lat: center.lat,
          lng: center.lng,
          description:
            "Location found via address search — not an official site, but you can still leave feedback here.",
        };

        searchResultMarker = L.marker(center, {
          icon: searchResultIcon(),
          zIndexOffset: 1000,
        }).addTo(map);
        searchResultMarker.bindPopup(`
          <div class="feature-popup">
            <p class="feature-popup__layer">${escapeHtml(searchedSite.name)}</p>
            <button type="button" class="btn btn--small search-feedback-btn">Leave feedback here</button>
          </div>
        `);
        searchResultMarker.on("popupopen", (ev) => {
          ev.popup
            .getElement()
            .querySelector(".search-feedback-btn")
            ?.addEventListener("click", () => {
              searchResultMarker.closePopup();
              openSiteDialog(searchedSite);
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
      helpBtn.innerHTML = "?";
      L.DomEvent.on(helpBtn, "click", L.DomEvent.stop).on(helpBtn, "click", () =>
        document.getElementById("help-dialog").showModal()
      );

      const fullscreenBtn = L.DomUtil.create("a", "", container);
      fullscreenBtn.href = "#";
      fullscreenBtn.title = "Toggle fullscreen";
      fullscreenBtn.setAttribute("role", "button");
      fullscreenBtn.setAttribute("aria-label", "Toggle fullscreen map");
      fullscreenBtn.innerHTML = "⛶";
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
      shareBtn.innerHTML = "🔗";
      L.DomEvent.on(shareBtn, "click", L.DomEvent.stop).on(
        shareBtn,
        "click",
        async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            shareBtn.innerHTML = "✅";
            setTimeout(() => {
              shareBtn.innerHTML = "🔗";
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
    const icon = active ? "✕" : "📍";
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
  const sitesById = new Map((config.sites || []).map((s) => [s.id, s]));
  const sentimentsById = new Map(
    (config.feedbackTypes || []).map((s) => [s.id, s])
  );
  const commentTopicsListEl = document.getElementById("comment-topics-list");
  const markersByLocationKey = new Map();
  let pendingCommentLocation = null;

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
    li.querySelector("input").addEventListener("change", (e) => {
      const visible = e.currentTarget.checked;
      markersByLocationKey.forEach((entry) => {
        if (entry.topicId !== topic.id) return;
        if (visible) entry.marker.addTo(map);
        else map.removeLayer(entry.marker);
      });
    });
    commentTopicsListEl.appendChild(li);
  });

  function commentMarkerIcon(color) {
    return L.divIcon({
      className: "comment-marker-wrapper",
      html: `<span class="comment-marker" style="background:${escapeHtml(
        color
      )}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    });
  }

  function locationKey(address, lat, lng) {
    return address || `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }

  // First comment at an address sets the marker's color/position; later
  // comments at the same address join its thread without moving or
  // recoloring the marker.
  function ensureLocationMarker(lat, lng, address, topicId) {
    const key = locationKey(address, lat, lng);
    let entry = markersByLocationKey.get(key);
    if (entry) return entry;

    const topic = topicsById.get(topicId);
    const marker = L.marker([lat, lng], {
      icon: commentMarkerIcon(topic ? topic.color : "#898781"),
    });
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openMapCommentDialog({ lat, lng, address });
    });
    const checkbox = commentTopicsListEl.querySelector(
      `input[data-topic-id="${topicId}"]`
    );
    if (!checkbox || checkbox.checked) marker.addTo(map);

    entry = { marker, topicId };
    markersByLocationKey.set(key, entry);
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

  async function loadMapComments() {
    if (!db) return;
    const { data, error } = await db
      .from("map_comments")
      .select("id, lat, lng, address, topic, created_at")
      .order("created_at", { ascending: true });
    if (error || !data) return;
    data.forEach((row) =>
      ensureLocationMarker(row.lat, row.lng, row.address || null, row.topic)
    );
  }
  loadMapComments();

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

  // Live activity feed — a running list across both feedback types
  // (site rankings and click-anywhere comments), newest first. Fetches a
  // batch from each table up front rather than paging the database
  // directly, since merging two tables' cursors is real complexity this
  // tool's realistic volume doesn't need yet; "Load more" just reveals
  // more of what's already in memory.
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

    const [commentsResult, submissionsResult] = await Promise.all([
      db
        .from("map_comments")
        .select("id, topic, lat, lng, address, created_at")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_FEED_FETCH_LIMIT),
      db
        .from("submissions")
        .select("id, site_id, created_at")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_FEED_FETCH_LIMIT),
    ]);

    const comments = (commentsResult.data || []).map((c) => ({
      type: "comment",
      created_at: c.created_at,
      topic: topicsById.get(c.topic) || null,
      lat: c.lat,
      lng: c.lng,
      address: c.address,
    }));
    const submissions = (submissionsResult.data || []).map((s) => ({
      type: "submission",
      created_at: s.created_at,
      site: sitesById.get(s.site_id) || null,
    }));

    activityItems = comments
      .concat(submissions)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
      const isComment = item.type === "comment";
      const color = isComment && item.topic ? item.topic.color : null;
      const label = isComment
        ? `A ${item.topic ? item.topic.label : "feedback"} marker was added`
        : `A ranking was submitted for ${
            item.site ? item.site.name : "a site"
          }`;
      // Comments always have a location. Submissions only open something
      // if their site is still in config.sites — an old submission for a
      // since-removed site has nothing to jump to.
      const clickable = isComment || !!item.site;

      const li = document.createElement("li");
      const row = document.createElement(clickable ? "button" : "div");
      row.className = clickable
        ? "activity-item activity-item--clickable"
        : "activity-item";
      if (clickable) row.type = "button";
      row.innerHTML = `
        <span class="activity-item__dot" style="background:${escapeHtml(
          color || "var(--text-muted)"
        )}"></span>
        <span class="activity-item__text">${escapeHtml(label)}</span>
        <span class="activity-item__time">${formatRelativeTime(
          item.created_at
        )}</span>
      `;
      if (clickable) {
        row.addEventListener("click", () => {
          if (isComment) {
            openMapCommentDialog({
              lat: item.lat,
              lng: item.lng,
              address: item.address,
            });
          } else {
            openSiteDialog(item.site);
            showTab("ideas");
            markersBySiteId.get(item.site.id)?.openTooltip();
          }
        });
      }
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
    if (presetTopic) mapCommentTopicSelect.value = presetTopic;
    document.getElementById("map-comment-text").value = "";
    // Reset to the unselected placeholder each time, so a sentiment
    // chosen for a previous comment can't be silently reused for this
    // one — it's required, and each comment should get a deliberate
    // choice.
    mapCommentSentimentSelect.value = "";
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
      .select("id, topic, sentiment, comment, created_at");
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
      listEl.innerHTML = `<li class="empty-msg">Couldn't load comments: ${escapeHtml(
        error.message
      )}</li>`;
      return;
    }
    if (!comments.length) {
      listEl.innerHTML = `<li class="empty-msg">No comments yet at this location — be the first!</li>`;
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
      li.innerHTML = `
        <div class="idea-card__top">
          <span class="idea-card__author" style="color:${escapeHtml(
            topic ? topic.color : "inherit"
          )}">${escapeHtml(topic ? topic.label : c.topic)}</span>
          <span class="idea-card__time">${formatDate(c.created_at)}</span>
        </div>
        ${
          sentiment
            ? `<span class="idea-card__sentiment">${escapeHtml(
                sentiment.label
              )}</span>`
            : ""
        }
        <p class="idea-card__comment">${escapeHtml(c.comment)}</p>
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
        statusEl.textContent = "Please add a comment before submitting.";
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

      const submitBtn = document.getElementById("submit-map-comment");
      submitBtn.disabled = true;
      statusEl.textContent = "Submitting…";
      statusEl.className = "status-msg";

      const { lat, lng, address } = pendingCommentLocation;
      const row = {
        lat,
        lng,
        address,
        topic: mapCommentTopicSelect.value,
        sentiment,
        comment,
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
      ensureLocationMarker(lat, lng, address, row.topic);
      refreshContributionCounter();
      loadTopicSummary();
      loadActivityFeed();
      refreshCommentThread(address, lat, lng);
    });

  const markersBySiteId = new Map();
  config.sites.forEach((site) => {
    const marker = L.marker([site.lat, site.lng]).addTo(map);
    marker.bindTooltip(site.name);
    marker.on("click", () => openSiteDialog(site));
    markersBySiteId.set(site.id, marker);
  });

  // ---------- Site list ----------
  const siteListEl = document.getElementById("site-list");
  config.sites.forEach((site) => {
    const li = document.createElement("li");
    li.className = "site-card";
    li.innerHTML = `
      <h3>${escapeHtml(site.name)}</h3>
      <p>${escapeHtml(site.description || "")}</p>
      <button type="button" class="btn btn--small">View &amp; respond</button>
    `;
    li.querySelector("button").addEventListener("click", () => {
      openSiteDialog(site);
      markersBySiteId.get(site.id)?.openTooltip();
    });
    siteListEl.appendChild(li);
  });

  // ---------- Dialog / tabs ----------
  const dialog = document.getElementById("site-dialog");
  let currentSite = null;

  const tabButtons = {
    respond: document.getElementById("tab-btn-respond"),
    ideas: document.getElementById("tab-btn-ideas"),
    results: document.getElementById("tab-btn-results"),
  };
  const tabPanels = {
    respond: document.getElementById("tab-respond"),
    ideas: document.getElementById("tab-ideas"),
    results: document.getElementById("tab-results"),
  };
  Object.keys(tabButtons).forEach((key) => {
    tabButtons[key].addEventListener("click", () => showTab(key));
  });

  function showTab(key) {
    Object.keys(tabButtons).forEach((k) => {
      const active = k === key;
      tabButtons[k].classList.toggle("is-active", active);
      tabButtons[k].setAttribute("aria-selected", String(active));
      tabPanels[k].hidden = !active;
    });
    if (key === "ideas") loadIdeas(currentSite.id);
    if (key === "results") loadResults(currentSite.id);
  }

  function openSiteDialog(site) {
    currentSite = site;
    document.getElementById("dialog-site-name").textContent = site.name;
    document.getElementById("dialog-site-description").textContent =
      site.description || "";
    document.getElementById("comment-input").value = "";
    document.getElementById("nickname-input").value = "";
    document.getElementById("submit-status").textContent = "";
    document.getElementById("submit-status").className = "status-msg";
    buildRankingList();
    showTab("respond");
    dialog.showModal();
  }

  // ---------- Ranking list (drag + up/down reorder) ----------
  const rankingListEl = document.getElementById("ranking-list");
  let rankingOrder = [];

  function buildRankingList() {
    rankingOrder = config.categories.map((c) => c.id);
    renderRankingList();
  }

  function renderRankingList() {
    rankingListEl.innerHTML = "";
    rankingOrder.forEach((catId, index) => {
      const cat = categoriesById.get(catId);
      const li = document.createElement("li");
      li.className = "ranking-row";
      li.draggable = true;
      li.dataset.catId = catId;
      li.innerHTML = `
        <span class="ranking-rank">${index + 1}</span>
        <span class="ranking-label">${escapeHtml(cat.label)}</span>
        <span class="ranking-move-btns">
          <button type="button" data-dir="up" aria-label="Move up" ${
            index === 0 ? "disabled" : ""
          }>▲</button>
          <button type="button" data-dir="down" aria-label="Move down" ${
            index === rankingOrder.length - 1 ? "disabled" : ""
          }>▼</button>
        </span>
      `;
      li.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          moveItem(catId, btn.dataset.dir === "up" ? -1 : 1);
        });
      });
      li.addEventListener("dragstart", () => {
        li.classList.add("dragging");
        li.dataset.dragging = "1";
      });
      li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
      });
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggingEl = rankingListEl.querySelector(".dragging");
        if (!draggingEl || draggingEl === li) return;
        const fromId = draggingEl.dataset.catId;
        const toIndex = rankingOrder.indexOf(catId);
        rankingOrder = rankingOrder.filter((id) => id !== fromId);
        rankingOrder.splice(toIndex, 0, fromId);
        renderRankingList();
      });
      rankingListEl.appendChild(li);
    });
  }

  function moveItem(catId, delta) {
    const index = rankingOrder.indexOf(catId);
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= rankingOrder.length) return;
    [rankingOrder[index], rankingOrder[newIndex]] = [
      rankingOrder[newIndex],
      rankingOrder[index],
    ];
    renderRankingList();
  }

  // ---------- Submit ranking ----------
  document
    .getElementById("submit-ranking")
    .addEventListener("click", async () => {
      const statusEl = document.getElementById("submit-status");
      if (!db) {
        statusEl.textContent =
          "Backend not configured — see README.md to enable saving.";
        statusEl.className = "status-msg is-error";
        return;
      }
      const nickname = document.getElementById("nickname-input").value.trim();
      const comment = document.getElementById("comment-input").value.trim();
      const submitBtn = document.getElementById("submit-ranking");
      submitBtn.disabled = true;
      statusEl.textContent = "Submitting…";
      statusEl.className = "status-msg";

      const { error } = await db.from("submissions").insert({
        site_id: currentSite.id,
        nickname: nickname || null,
        rankings: rankingOrder,
        comment: comment || null,
        voter_token: voterToken,
      });

      submitBtn.disabled = false;
      if (error) {
        statusEl.textContent = `Something went wrong: ${error.message}`;
        statusEl.className = "status-msg is-error";
        return;
      }
      statusEl.textContent = "Thanks! Your ranking was submitted.";
      statusEl.className = "status-msg is-ok";
      refreshContributionCounter();
      loadActivityFeed();
    });

  // ---------- Community ideas (submissions + upvotes) ----------
  async function loadIdeas(siteId) {
    const listEl = document.getElementById("ideas-list");
    if (!db) {
      listEl.innerHTML = `<li class="empty-msg">Backend not configured — see README.md.</li>`;
      return;
    }
    listEl.innerHTML = `<li class="empty-msg">Loading…</li>`;

    const { data: submissions, error } = await db
      .from("submissions")
      .select("id, nickname, rankings, comment, created_at")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (error) {
      listEl.innerHTML = `<li class="empty-msg">Couldn't load ideas: ${escapeHtml(
        error.message
      )}</li>`;
      return;
    }
    if (!submissions.length) {
      listEl.innerHTML = `<li class="empty-msg">No submissions yet for this site — be the first!</li>`;
      return;
    }

    const submissionIds = submissions.map((s) => s.id);
    const { data: upvotes } = await db
      .from("upvotes")
      .select("id, submission_id, voter_token")
      .in("submission_id", submissionIds);

    const upvotesBySubmission = new Map();
    (upvotes || []).forEach((u) => {
      if (!upvotesBySubmission.has(u.submission_id)) {
        upvotesBySubmission.set(u.submission_id, []);
      }
      upvotesBySubmission.get(u.submission_id).push(u);
    });

    listEl.innerHTML = "";
    submissions.forEach((sub) => {
      const votes = upvotesBySubmission.get(sub.id) || [];
      const myVote = votes.find((v) => v.voter_token === voterToken);
      const topPicks = (sub.rankings || [])
        .slice(0, 3)
        .map((id) => categoriesById.get(id)?.label || id)
        .join(", ");

      const li = document.createElement("li");
      li.className = "idea-card";
      li.innerHTML = `
        <div class="idea-card__top">
          <span class="idea-card__author">${escapeHtml(
            sub.nickname || "Neighbour"
          )}</span>
          <span class="idea-card__time">${formatDate(sub.created_at)}</span>
        </div>
        <p class="idea-card__top-picks">Top picks: ${escapeHtml(
          topPicks || "—"
        )}</p>
        ${
          sub.comment
            ? `<p class="idea-card__comment">${escapeHtml(sub.comment)}</p>`
            : ""
        }
        <button type="button" class="upvote-btn${
          myVote ? " is-active" : ""
        }" data-submission-id="${sub.id}">
          ▲ Support (${votes.length})
        </button>
      `;
      li.querySelector(".upvote-btn").addEventListener("click", (e) =>
        toggleUpvote(e.currentTarget, sub.id, Boolean(myVote))
      );
      listEl.appendChild(li);
    });
  }

  async function toggleUpvote(button, submissionId, currentlyVoted) {
    button.disabled = true;
    if (currentlyVoted) {
      await db
        .from("upvotes")
        .delete()
        .eq("submission_id", submissionId)
        .eq("voter_token", voterToken);
    } else {
      await db
        .from("upvotes")
        .insert({ submission_id: submissionId, voter_token: voterToken });
    }
    button.disabled = false;
    loadIdeas(currentSite.id);
  }

  // ---------- Results (aggregate bar chart) ----------
  async function loadResults(siteId) {
    const chartEl = document.getElementById("results-chart");
    if (!db) {
      chartEl.innerHTML = `<p class="empty-msg">Backend not configured — see README.md.</p>`;
      return;
    }
    chartEl.innerHTML = `<p class="empty-msg">Loading…</p>`;

    const { data: submissions, error } = await db
      .from("submissions")
      .select("rankings")
      .eq("site_id", siteId);

    if (error) {
      chartEl.innerHTML = `<p class="empty-msg">Couldn't load results: ${escapeHtml(
        error.message
      )}</p>`;
      return;
    }
    if (!submissions.length) {
      chartEl.innerHTML = `<p class="empty-msg">No rankings submitted yet for this site.</p>`;
      return;
    }

    const n = config.categories.length;
    const totals = new Map(config.categories.map((c) => [c.id, 0]));
    submissions.forEach((sub) => {
      (sub.rankings || []).forEach((catId, index) => {
        if (!totals.has(catId)) return;
        // Rank 0 (most wanted) scores n points, last rank scores 1 point.
        totals.set(catId, totals.get(catId) + (n - index));
      });
    });

    const results = config.categories
      .map((c) => ({
        id: c.id,
        label: c.label,
        avgScore: totals.get(c.id) / submissions.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const maxScore = Math.max(...results.map((r) => r.avgScore), 1);

    chartEl.innerHTML = "";
    results.forEach((r) => {
      const pct = Math.max((r.avgScore / maxScore) * 100, 1);
      const row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML = `
        <span class="result-row__label">${escapeHtml(r.label)}</span>
        <span class="result-row__track">
          <span class="result-row__bar" style="width:${pct}%"></span>
        </span>
        <span class="result-row__value">${r.avgScore.toFixed(1)}</span>
      `;
      chartEl.appendChild(row);
    });
  }

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

  fetch("data/sources.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((sourcesConfig) => {
      if (!sourcesConfig || !Array.isArray(sourcesConfig.layers)) return;
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
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, { icon: glyphIcon(theme) }),
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindPopup(
          buildFeaturePopup(layer.label, theme, feature.properties)
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

  // One glyph per category (see themes in js/config.js), on a colored
  // badge — legible on sight without opening a legend, and replaces the
  // old circle/diamond/triangle shapes that only distinguished layers
  // from each other, not what they actually were.
  function glyphIcon(theme) {
    return L.divIcon({
      className: "glyph-marker-wrapper",
      html: `<span class="glyph-marker" style="background:${escapeHtml(
        theme.color
      )}">${escapeHtml(theme.glyph || "📍")}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    });
  }

  // Datasets use wildly different property naming conventions for
  // addresses across the 11 layers — check the common ones before falling
  // back to reverse-geocoding the feature's location.
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

  function extractFeatureAddress(properties) {
    for (const key of ADDRESS_PROPERTY_CANDIDATES) {
      const value = properties && properties[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
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
      address: extractFeatureAddress(feature.properties) || undefined,
      presetTopic: theme.id,
    });
  }

  function buildFeaturePopup(layerLabel, theme, properties) {
    const rows = Object.entries(properties || {})
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .slice(0, 12)
      .map(
        ([k, v]) =>
          `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`
      )
      .join("");
    return `
      <div class="feature-popup">
        <p class="feature-popup__layer">${escapeHtml(layerLabel)}</p>
        <table class="feature-popup__table">${rows}</table>
        <button type="button" class="btn btn--small feature-feedback-btn">Leave feedback about this</button>
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
