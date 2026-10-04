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
// cabinet doesn't blend into the color of the room it sits inside). Chosen
// to be mutually distinct from each other AND from FALLBACK_NESTED_COLOR
// and TOOL_MARKER_COLOR below -- table used to share the exact same hex as
// the generic nested fallback, so an unkinded tool marker (like a
// precisely-placed tool with no kind set) visually vanished into any
// "table"-kind container it happened to sit inside.
export const KIND_COLORS: Record<string, string> = {
  area: "#1976d2",
  cabinet: "#6d4c41",
  shelf: "#8e24aa",
  drawer: "#00897b",
  table: "#f9a825",
  bin: "#9e9d24",
};

// Fallback for a nested location with no recognized kind (the admin editor
// passes its own plain blue instead -- see colorForKind's own comment).
export const FALLBACK_NESTED_COLOR = "#e65100";

// Reserved for ANY location that has a tool assigned to it, regardless of
// its own kind -- takes priority over kind/fallback color everywhere a
// tool's exact spot needs to be unmistakable at a glance, per instruction:
// tools get their own color, not whatever their container happens to be.
export const TOOL_MARKER_COLOR = "#2e7d32";

// No single global default -- what an unset/unrecognized kind should fall
// back to depends on context (the admin editor only ever shows one zoom
// level at a time, so its old plain blue is still a fine default; the
// Workshops-page map flattens every level onto one image, so a nested item
// needs a fallback that's guaranteed not to match a shop's own color).
export const colorForKind = (kind: string | undefined, fallback: string) =>
  (kind && KIND_COLORS[kind]) || fallback;

export const labelForKind = (kind: string | undefined) => (kind && KIND_LABELS[kind]) || undefined;
