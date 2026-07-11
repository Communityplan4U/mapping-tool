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
