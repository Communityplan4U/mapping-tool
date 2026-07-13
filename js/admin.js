(function () {
  "use strict";

  const config = window.APP_CONFIG;
  const topicsById = new Map((config.themes || []).map((t) => [t.id, t]));
  const sentimentsById = new Map(
    (config.feedbackTypes || []).map((s) => [s.id, s])
  );

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

  let latestMapComments = [];

  async function loadMapComments() {
    const tbody = document.querySelector("#map-comments-table tbody");
    const summaryEl = document.getElementById("map-comments-summary");
    if (!db) return;
    summaryEl.textContent = "Loading…";

    const { data, error } = await db
      .from("map_comments")
      .select(
        "topic, sentiment, year_last_there, comment, name, contact, photo_url, lat, lng, address, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      summaryEl.textContent = `Couldn't load map feedback: ${error.message}`;
      return;
    }

    latestMapComments = data || [];
    summaryEl.textContent = `${latestMapComments.length.toLocaleString()} idea/archive ${
      latestMapComments.length === 1 ? "entry" : "entries"
    }`;

    tbody.innerHTML = latestMapComments
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(topicsById.get(row.topic)?.label || row.topic)}</td>
            <td>${escapeHtml(
              sentimentsById.get(row.sentiment)?.label || row.sentiment || ""
            )}</td>
            <td>${escapeHtml(
              row.year_last_there != null ? String(row.year_last_there) : ""
            )}</td>
            <td>${escapeHtml(row.comment || "")}</td>
            <td>${escapeHtml(row.name || "")}</td>
            <td>${escapeHtml(row.contact || "")}</td>
            <td>${
              row.photo_url
                ? `<a href="${escapeHtml(
                    row.photo_url
                  )}" target="_blank" rel="noopener noreferrer">photo</a>`
                : ""
            }</td>
            <td>${escapeHtml(
              row.address || `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
            )}</td>
            <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          </tr>
        `
      )
      .join("");
  }

  document
    .getElementById("export-map-comments")
    .addEventListener("click", () => {
      downloadCSV(
        "map-feedback.csv",
        [
          "Topic",
          "Feedback type",
          "Year last there",
          "Idea/Archive",
          "Name",
          "Contact",
          "Photo",
          "Address",
          "Latitude",
          "Longitude",
          "Submitted",
        ],
        latestMapComments.map((row) => [
          topicsById.get(row.topic)?.label || row.topic,
          sentimentsById.get(row.sentiment)?.label || row.sentiment || "",
          row.year_last_there ?? "",
          row.comment || "",
          row.name || "",
          row.contact || "",
          row.photo_url || "",
          row.address || "",
          row.lat,
          row.lng,
          formatDateTime(row.created_at),
        ])
      );
    });

  loadMapComments();
})();
