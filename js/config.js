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

  // The list of possible uses residents rank for each site. Order here is
  // just the default/unranked order shown before anyone drags or reorders.
  categories: [
    { id: "park", label: "Public park / green space" },
    { id: "garden", label: "Community garden" },
    { id: "playground", label: "Playground" },
    { id: "housing", label: "Affordable housing" },
    { id: "market", label: "Small business / market space" },
    { id: "centre", label: "Community centre / gathering space" },
    { id: "sport", label: "Sports courts" },
    { id: "art", label: "Public art / cultural space" },
    { id: "plaza", label: "Seating plaza / public square" },
    { id: "natural", label: "Leave as natural space" },
  ],

  // What kind of thing a piece of click-anywhere map feedback is —
  // separate from its topic (Housing, Parks, etc. — see themes below).
  // Required when leaving feedback. "losing" gets its own option rather
  // than folding into a generic "concern" bucket: a record of
  // displacement/loss at volume is evidence a generic concern option
  // wouldn't surface on its own.
  feedbackTypes: [
    { id: "losing", label: "A place I'm losing, or have lost" },
    { id: "concern", label: "A concern — something that doesn't feel right" },
    { id: "working", label: "Something that's working — keep it" },
    { id: "idea", label: "An idea or suggestion for the future" },
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
  // `glyph` is the emoji shown on every point marker in that category, so
  // categories are legible on sight without opening the legend — replaces
  // the old circle/diamond/triangle shape system (see data/sources.json
  // history if you need to bring per-layer shapes back for some reason).
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

  // Add real public land parcels here as they're identified. To get
  // coordinates: right-click the spot on https://www.google.com/maps and
  // click the lat/lng that appears. Example entry:
  // {
  //   id: "some-unique-id",
  //   name: "Site name",
  //   lat: 43.1234,
  //   lng: -79.1234,
  //   description: "Current condition, approximate size, who owns it.",
  // },
  sites: [],
};
