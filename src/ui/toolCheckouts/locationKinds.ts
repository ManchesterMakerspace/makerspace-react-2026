// Location#kind is free text server-side (not a fixed enum), but the map
// needs a bounded set to draw consistent colors/labels from. Anything
// outside this list (including blank/unset) falls back to DEFAULT_KIND.
export const LOCATION_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— unspecified —" },
  { value: "area", label: "Room / Area" },
  { value: "cabinet", label: "Cabinet" },
  { value: "shelf", label: "Shelf" },
  { value: "drawer", label: "Drawer" },
  { value: "table", label: "Table / Workbench" },
  { value: "bin", label: "Bin" },
];

export const KIND_LABELS: Record<string, string> = Object.fromEntries(
  LOCATION_KIND_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
);

// One fixed color per kind, independent of any shop's own color -- used
// wherever multiple nesting levels render on the same image at once (so a
// cabinet doesn't blend into the color of the room it sits inside).
export const KIND_COLORS: Record<string, string> = {
  area: "#1976d2",
  cabinet: "#6d4c41",
  shelf: "#8e24aa",
  drawer: "#00897b",
  table: "#e65100",
  bin: "#fbc02d",
};

// No single global default -- what an unset/unrecognized kind should fall
// back to depends on context (the admin editor only ever shows one zoom
// level at a time, so its old plain blue is still a fine default; the
// Workshops-page map flattens every level onto one image, so a nested item
// needs a fallback that's guaranteed not to match a shop's own color).
export const colorForKind = (kind: string | undefined, fallback: string) =>
  (kind && KIND_COLORS[kind]) || fallback;

export const labelForKind = (kind: string | undefined) => (kind && KIND_LABELS[kind]) || undefined;
