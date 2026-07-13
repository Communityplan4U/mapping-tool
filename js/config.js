// Community Land Use Mapping Tool — configuration
//
// Edit this file to point the app at your own Supabase project and to
// replace the sample sites/categories with your neighbourhood's real data.

window.APP_CONFIG = {
  // Create a free project at https://supabase.com, run supabase/schema.sql
  // in its SQL editor, then paste the Project URL and anon public key here.
  // See README.md for step-by-step instructions.
  supabaseUrl: "https://vyytuffjlhkgckqiszzl.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5eXR1ZmZqbGhrZ2NrcWlzenpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODI0NzMsImV4cCI6MjA5OTM1ODQ3M30.UHNHZE31W9QuzoH-_yhokiwjODqOEGGcQrE979ttwsk",

  neighbourhood: {
    name: "Little Jamaica, Toronto",
    center: [43.6955, -79.449],
    zoom: 15,
  },

  // Areas residents draw and label themselves (a property, a site, a spot
  // they want to point out). They're all one map-layer category, shown in
  // this colour. See map_areas in supabase/schema.sql.
  userAreas: { label: "User Identified", color: "#8b5cf6" },

  // What kind of thing a piece of click-anywhere map feedback is —
  // separate from its topic (Housing, Parks, etc. — see themes below).
  // Required when leaving feedback. "losing" gets its own option rather
  // than folding into a generic "concern" bucket: a record of
  // displacement/loss at volume is evidence a generic concern option
  // wouldn't surface on its own. The optional "hint" is shown next to the
  // idea/archive box when that option is selected — a nudge, not a
  // required field, so it doesn't need a schema change to add one for
  // another option later. "askYear" is the same kind of opt-in extra: it
  // shows a "what year was it last there" field, generic to any type
  // rather than hardcoded to "losing" specifically.
  // `shortLabel` is used where the full sentence is too long — the
  // feedback-type filter chips and the browse list's type badge. Falls
  // back to `label` if omitted.
  feedbackTypes: [
    {
      id: "losing",
      label: "A place being displaced or that is no longer there",
      shortLabel: "Displaced / gone",
      hint: "If you can, include the name of the place and a link to a photo of it — it helps build the record of what's been lost.",
      askYear: true,
    },
    {
      id: "concern",
      label: "A concern — something that doesn't feel right",
      shortLabel: "Concern",
    },
    {
      id: "working",
      label: "Something that's working — keep it",
      shortLabel: "Working",
    },
    {
      id: "idea",
      label: "An idea or suggestion for the future",
      shortLabel: "Idea",
    },
  ],

  // Shared taxonomy used by BOTH the open data layers (the "theme" field
  // on each entry in data/sources.json) and community feedback (the topic
  // residents pick when leaving a comment). One taxonomy, one color and
  // one map-marker glyph per theme, reused everywhere that theme shows up
  // — layer markers, the "Map layers" and "Community feedback" panel
  // checkboxes, the feedback dropdown, and the "Feedback by topic" chart.
  //
  // Based on the Little Jamaica Community Development Action Plan's 5
  // focus areas (Housing, Commercial & Non-Profit Spaces, Employment,
  // Cultural Identity & Stewardship — Governance was one of the 5 too, but
  // was removed: every open-data location that could plausibly belong to
  // it turned out to duplicate another category or be routine City
  // land-holding with nothing resident-facing to say, so it's not offered
  // as a map layer or feedback category), plus 4 added categories for
  // things the CDAP doesn't explicitly name but this tool still needs to
  // represent (Parks & Public Realm, Transportation, Public Facilities,
  // Urban & Community Planning). Colors are the 8 hues of the fixed
  // palette (see README.md) — Urban & Community Planning reclaims the
  // blue slot Governance retired.
  //
  // `glyph` is a legacy emoji label kept for reference. Community-feedback
  // markers now draw a purpose-made line icon per category instead (see
  // ICON_PATHS in js/app.js, keyed by these ids) — crisper than emoji and
  // able to take the theme color. Add a matching entry to ICON_PATHS when
  // you add a category; anything without one falls back to a generic pin.
  themes: [
    { id: "housing", label: "Housing", color: "#e87ba4", glyph: "🏠" },
    {
      id: "commercial-nonprofit",
      label: "Commercial & Non-Profit Spaces",
      color: "#eda100",
      glyph: "🏪",
    },
    { id: "employment", label: "Employment", color: "#eb6834", glyph: "💼" },
    {
      id: "cultural-identity",
      label: "Cultural Identity & Stewardship",
      color: "#4a3aa7",
      glyph: "🎨",
    },
    {
      id: "parks-public-realm",
      label: "Parks & Public Realm",
      color: "#1baf7a",
      glyph: "🌳",
    },
    {
      id: "transportation",
      label: "Transportation",
      color: "#e34948",
      glyph: "🚌",
    },
    {
      id: "community-services",
      label: "Public Facilities",
      color: "#008300",
      glyph: "🏛️",
    },
    {
      id: "urban-community-planning",
      label: "Urban and Community Planning",
      color: "#2a78d6",
      glyph: "🗺️",
    },
  ],
};
