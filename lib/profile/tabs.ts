// Plain (non-"use client") module so Server Components can import
// PROFILE_TABS directly. Importing a non-component value from a "use
// client" module into a Server Component doesn't cross the boundary as
// a real array in production builds -- it serializes as an opaque
// client reference, so `PROFILE_TABS.includes(...)` fails at runtime
// with "includes is not a function" (confirmed via production error
// logs on /users/[handle]). Components/profile/profile-tabs.tsx (the
// actual client component) imports this same source of truth.
export const TAB_LABELS: Record<string, string> = {
  takes: "Takes",
  predictions: "Predictions",
  debates: "Debates",
  communities: "Communities",
  about: "About",
};
export const PROFILE_TABS = Object.keys(TAB_LABELS);
