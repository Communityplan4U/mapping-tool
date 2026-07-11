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
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

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

  // Fullscreen control (native Fullscreen API, no plugin needed).
  const FullscreenControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control leaflet-control-custom"
      );
      const button = L.DomUtil.create("a", "", container);
      button.href = "#";
      button.title = "Toggle fullscreen";
      button.setAttribute("role", "button");
      button.setAttribute("aria-label", "Toggle fullscreen map");
      button.innerHTML = "⛶";
      L.DomEvent.on(button, "click", L.DomEvent.stop).on(button, "click", () =>
        toggleMapFullscreen()
      );
      return container;
    },
  });
  map.addControl(new FullscreenControl());

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

  // Share control (copies this page's URL to the clipboard).
  const ShareControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control leaflet-control-custom"
      );
      const button = L.DomUtil.create("a", "", container);
      button.href = "#";
      button.title = "Copy link to this map";
      button.setAttribute("role", "button");
      button.setAttribute("aria-label", "Copy link to this map");
      button.innerHTML = "🔗";
      L.DomEvent.on(button, "click", L.DomEvent.stop).on(
        button,
        "click",
        async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            button.innerHTML = "✅";
            setTimeout(() => {
              button.innerHTML = "🔗";
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
  map.addControl(new ShareControl());

  // ---------- Map comments (click-anywhere feedback) ----------
  // Separate from the per-site ranking system: click anywhere on the map
  // to leave a topic-tagged comment at that exact point. Stored in the
  // map_comments table (see supabase/schema.sql) and rendered as square
  // markers — a shape not used by any open data layer — so a resident's
  // own feedback is never confused with official City data.
  const topicsById = new Map(
    (config.mapCommentTopics || []).map((t) => [t.id, t])
  );
  const commentTopicsListEl = document.getElementById("comment-topics-list");
  const commentMarkersByTopic = new Map();
  let pendingCommentLatLng = null;

  (config.mapCommentTopics || []).forEach((topic) => {
    commentMarkersByTopic.set(topic.id, []);

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
      (commentMarkersByTopic.get(topic.id) || []).forEach((marker) => {
        if (visible) marker.addTo(map);
        else map.removeLayer(marker);
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

  function addCommentMarker(row) {
    const topic = topicsById.get(row.topic);
    if (!topic) return;
    const marker = L.marker([row.lat, row.lng], {
      icon: commentMarkerIcon(topic.color),
    });
    marker.bindPopup(`
      <div class="feature-popup">
        <p class="feature-popup__layer">${escapeHtml(topic.label)}</p>
        <p>${escapeHtml(row.comment)}</p>
        <p class="muted">${escapeHtml(formatDate(row.created_at))}</p>
      </div>
    `);
    marker.on("click", (e) => L.DomEvent.stopPropagation(e));
    commentMarkersByTopic.get(row.topic)?.push(marker);
    const checkbox = commentTopicsListEl.querySelector(
      `input[data-topic-id="${row.topic}"]`
    );
    if (!checkbox || checkbox.checked) marker.addTo(map);
    return marker;
  }

  async function loadMapComments() {
    if (!db) return;
    const { data, error } = await db
      .from("map_comments")
      .select("id, lat, lng, topic, comment, created_at");
    if (error || !data) return;
    data.forEach(addCommentMarker);
  }
  loadMapComments();

  const mapCommentDialog = document.getElementById("map-comment-dialog");
  const mapCommentTopicSelect = document.getElementById("map-comment-topic");
  (config.mapCommentTopics || []).forEach((topic) => {
    const opt = document.createElement("option");
    opt.value = topic.id;
    opt.textContent = topic.label;
    mapCommentTopicSelect.appendChild(opt);
  });

  map.on("click", (e) => {
    if (!config.mapCommentTopics || config.mapCommentTopics.length === 0) {
      return;
    }
    pendingCommentLatLng = e.latlng;
    document.getElementById(
      "map-comment-location"
    ).textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    document.getElementById("map-comment-text").value = "";
    const statusEl = document.getElementById("map-comment-status");
    statusEl.textContent = "";
    statusEl.className = "status-msg";
    mapCommentDialog.showModal();
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
      if (!pendingCommentLatLng) return;
      const comment = document
        .getElementById("map-comment-text")
        .value.trim();
      if (!comment) {
        statusEl.textContent = "Please add a comment before submitting.";
        statusEl.className = "status-msg is-error";
        return;
      }

      const submitBtn = document.getElementById("submit-map-comment");
      submitBtn.disabled = true;
      statusEl.textContent = "Submitting…";
      statusEl.className = "status-msg";

      const row = {
        lat: pendingCommentLatLng.lat,
        lng: pendingCommentLatLng.lng,
        topic: mapCommentTopicSelect.value,
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
      addCommentMarker({ ...row, created_at: new Date().toISOString() });
      refreshContributionCounter();
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
  // Layer metadata (id/label/color) comes from data/sources.json; the
  // actual shapes for a layer live in data/<id>.geojson, both generated by
  // scripts/fetch-open-data.js (see README.md). Shapes are fetched lazily,
  // the first time a layer is switched on.
  const layersListEl = document.getElementById("layers-list");
  const layersStatusEl = document.getElementById("layers-status");
  const loadedDataLayers = new Map();

  fetch("data/sources.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((sourcesConfig) => {
      if (!sourcesConfig || !Array.isArray(sourcesConfig.layers)) return;
      sourcesConfig.layers.forEach(addLayerToggle);
    })
    .catch(() => {
      // Open data layers are optional — if data/sources.json hasn't been
      // generated yet, just show the site without any overlay layers.
    });

  function addLayerToggle(layer) {
    const li = document.createElement("li");
    li.className = "layers-list__item";
    const color = layer.color || "#2a78d6";
    const swatchClass = [
      "layers-list__swatch",
      layer.shape === "diamond" ? "layers-list__swatch--diamond" : "",
      layer.dashed ? "layers-list__swatch--dashed" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const swatchStyle = layer.dashed
      ? `border-color:${color}`
      : `background:${color}`;
    li.innerHTML = `
      <label>
        <input type="checkbox" data-layer-id="${escapeHtml(layer.id)}" />
        <span class="${swatchClass}" style="${escapeHtml(
          swatchStyle
        )}"></span>
        ${escapeHtml(layer.label)}
      </label>
    `;
    li.querySelector("input").addEventListener("change", (e) =>
      toggleDataLayer(layer, e.currentTarget)
    );
    layersListEl.appendChild(li);
  }

  async function toggleDataLayer(layer, checkbox) {
    checkbox.disabled = true;
    layersStatusEl.textContent = "";
    layersStatusEl.classList.remove("layers-status--info");
    try {
      if (checkbox.checked) {
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
            layersStatusEl.textContent = `"${layer.label}" has no shapes in this area.`;
            layersStatusEl.classList.add("layers-status--info");
          }
          geoLayer = buildGeoJSONLayer(layer, geojson);
          loadedDataLayers.set(layer.id, geoLayer);
        }
        geoLayer.addTo(map);
      } else {
        const geoLayer = loadedDataLayers.get(layer.id);
        if (geoLayer) map.removeLayer(geoLayer);
      }
    } catch (err) {
      checkbox.checked = false;
      layersStatusEl.textContent = `Couldn't load "${layer.label}": ${err.message}`;
    } finally {
      checkbox.disabled = false;
    }
  }

  function buildGeoJSONLayer(layer, geojson) {
    const color = layer.color || "#2a78d6";
    return L.geoJSON(geojson, {
      style: () => ({
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        dashArray: layer.dashed ? "6 4" : null,
      }),
      pointToLayer: (feature, latlng) =>
        layer.shape === "diamond"
          ? L.marker(latlng, { icon: diamondIcon(color) })
          : L.circleMarker(latlng, {
              radius: 6,
              color,
              fillColor: color,
              fillOpacity: 0.7,
              weight: 2,
            }),
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.bindPopup(
          buildFeaturePopup(layer.label, feature.properties)
        );
        // Path-based layers (polygons, circleMarkers) bubble clicks to the
        // map by default, which would also open the "leave feedback here"
        // dialog. Stop it so clicking a shape only opens its own popup.
        leafletLayer.on("click", (e) => L.DomEvent.stopPropagation(e));
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

  function buildFeaturePopup(layerLabel, properties) {
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
})();
