(function () {
  "use strict";

  const config = window.APP_CONFIG;
  const categoriesById = new Map(
    (config.categories || []).map((c) => [c.id, c])
  );
  const topicsById = new Map(
    (config.mapCommentTopics || []).map((t) => [t.id, t])
  );
  const siteNameById = new Map((config.sites || []).map((s) => [s.id, s.name]));

  const isConfigured =
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.startsWith("YOUR_") &&
    !config.supabaseAnonKey.startsWith("YOUR_");

  const db = isConfigured
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  if (!isConfigured) {
    document.getElementById("admin-config-warning").hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || "";
    }
  }

  function siteLabel(siteId) {
    if (siteNameById.has(siteId)) return siteNameById.get(siteId);
    if (typeof siteId === "string" && siteId.startsWith("search-")) {
      return `Address search location (${siteId})`;
    }
    return siteId;
  }

  function topPicks(rankings) {
    return (rankings || [])
      .slice(0, 3)
      .map((id) => categoriesById.get(id)?.label || id)
      .join(", ");
  }

  function csvEscape(value) {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function downloadCSV(filename, headers, rows) {
    const lines = [headers.map(csvEscape).join(",")].concat(
      rows.map((row) => row.map(csvEscape).join(","))
    );
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  let latestSubmissions = [];
  let latestMapComments = [];

  async function loadSubmissions() {
    const tbody = document.querySelector("#submissions-table tbody");
    const summaryEl = document.getElementById("submissions-summary");
    if (!db) return;
    summaryEl.textContent = "Loading…";

    const { data, error } = await db
      .from("submissions")
      .select("site_id, nickname, rankings, comment, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      summaryEl.textContent = `Couldn't load submissions: ${error.message}`;
      return;
    }

    latestSubmissions = data || [];
    summaryEl.textContent = `${latestSubmissions.length.toLocaleString()} submission${
      latestSubmissions.length === 1 ? "" : "s"
    }`;

    tbody.innerHTML = latestSubmissions
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(siteLabel(row.site_id))}</td>
            <td>${escapeHtml(row.nickname || "Neighbour")}</td>
            <td>${escapeHtml(topPicks(row.rankings))}</td>
            <td>${escapeHtml(row.comment || "")}</td>
            <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          </tr>
        `
      )
      .join("");
  }

  async function loadMapComments() {
    const tbody = document.querySelector("#map-comments-table tbody");
    const summaryEl = document.getElementById("map-comments-summary");
    if (!db) return;
    summaryEl.textContent = "Loading…";

    const { data, error } = await db
      .from("map_comments")
      .select("topic, comment, lat, lng, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      summaryEl.textContent = `Couldn't load map feedback: ${error.message}`;
      return;
    }

    latestMapComments = data || [];
    summaryEl.textContent = `${latestMapComments.length.toLocaleString()} comment${
      latestMapComments.length === 1 ? "" : "s"
    }`;

    tbody.innerHTML = latestMapComments
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(topicsById.get(row.topic)?.label || row.topic)}</td>
            <td>${escapeHtml(row.comment || "")}</td>
            <td>${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}</td>
            <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          </tr>
        `
      )
      .join("");
  }

  document
    .getElementById("export-submissions")
    .addEventListener("click", () => {
      downloadCSV(
        "site-submissions.csv",
        ["Site", "Nickname", "Top picks", "Comment", "Submitted"],
        latestSubmissions.map((row) => [
          siteLabel(row.site_id),
          row.nickname || "Neighbour",
          topPicks(row.rankings),
          row.comment || "",
          formatDateTime(row.created_at),
        ])
      );
    });

  document
    .getElementById("export-map-comments")
    .addEventListener("click", () => {
      downloadCSV(
        "map-feedback.csv",
        ["Topic", "Comment", "Latitude", "Longitude", "Submitted"],
        latestMapComments.map((row) => [
          topicsById.get(row.topic)?.label || row.topic,
          row.comment || "",
          row.lat,
          row.lng,
          formatDateTime(row.created_at),
        ])
      );
    });

  loadSubmissions();
  loadMapComments();
})();
