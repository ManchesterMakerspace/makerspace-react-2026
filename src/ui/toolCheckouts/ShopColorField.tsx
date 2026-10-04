import * as React from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { GoogleCalendarColor } from "app/entities/toolCheckout";
import { listGoogleCalendarColors } from "api/toolCheckouts";

export const FALLBACK_COLORS: GoogleCalendarColor[] = [
  ["1", "Lavender", "#a4bdfc", "#1d1d1d"],
  ["2", "Sage", "#7ae7bf", "#1d1d1d"],
  ["3", "Grape", "#dbadff", "#1d1d1d"],
  ["4", "Flamingo", "#ff887c", "#1d1d1d"],
  ["5", "Banana", "#fbd75b", "#1d1d1d"],
  ["6", "Tangerine", "#ffb878", "#1d1d1d"],
  ["7", "Peacock", "#46d6db", "#1d1d1d"],
  ["8", "Graphite", "#e1e1e1", "#1d1d1d"],
  ["9", "Blueberry", "#5484ed", "#1d1d1d"],
  ["10", "Basil", "#51b749", "#1d1d1d"],
  ["11", "Tomato", "#dc2127", "#1d1d1d"],
].map(([id, name, backgroundColor, foregroundColor]) => ({
  id, name, backgroundColor, foregroundColor
}));

// Which shops use each color id, as { colorId: [shop names] }. Pass the shop
// being edited as `excludeShopId` so its own color isn't reported as shared.
export const colorUsage = (
  shops: { id: string; name: string; colorId?: string }[] = [],
  excludeShopId?: string
): Record<string, string[]> =>
  shops
    .filter(shop => shop.id !== excludeShopId && !!shop.colorId)
    .reduce<Record<string, string[]>>((usage, shop) => {
      usage[shop.colorId!] = [...(usage[shop.colorId!] || []), shop.name];
      return usage;
    }, {});

// "A", "A and B", "A, B, and C" -- and past three, "A, B, C, and 5 others" so a
// popular color does not produce a paragraph.
const joinNames = (names: string[]) => {
  if (names.length <= 2) return names.join(" and ");
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  const others = names.length - 3;
  return `${names.slice(0, 3).join(", ")}, and ${others} other${others === 1 ? "" : "s"}`;
};

const ShopColorField: React.FC<{
  value?: string;
  onChange: (colorId: string) => void;
  // Which OTHER shops already use each color (see colorUsage). A shared color
  // is allowed -- there are only 11 colors -- so it is flagged in the list and
  // warned about, never blocked. A new shop is still given an unused color
  // by default when there is one.
  usedBy?: Record<string, string[]>;
}> = ({ value = "", onChange, usedBy = {} }) => {
  const [colors, setColors] = React.useState<GoogleCalendarColor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const sharedWith = usedBy[value] || [];

  React.useEffect(() => {
    let active = true;
    listGoogleCalendarColors({ colorId: value || undefined }).then(result => {
      if (!active) return;
      if (result.data) {
        const available = result.data.colors.map((color, index) => ({
          ...color,
          name: color.name || `Color ${index + 1}`
        }));
        setColors(available);
        if (available[0] && !available.some(color => color.id === value)) {
          const defaultColor = available.find(color => !usedBy[color.id]) || available[0];
          onChange(defaultColor.id);
        }
      } else {
        setColors(FALLBACK_COLORS);
        setError(
          `${result.error?.message || "Google Calendar colors could not be loaded."} ` +
          "Using the fallback color palette."
        );
        if (!FALLBACK_COLORS.some(color => color.id === value)) {
          const defaultColor = FALLBACK_COLORS.find(color => !usedBy[color.id]) || FALLBACK_COLORS[0];
          onChange(defaultColor.id);
        }
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <>
      <TextField
        select
        fullWidth
        label="Shop color"
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={loading}
        helperText={loading
          ? "Loading curated Google Calendar colors…"
          : "Used for the shop label and all shop/tool reservation events."}
        slotProps={{
          select: {
            renderValue: selected => {
              const color = colors.find(item => item.id === selected);
              return color
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden style={{
                      width: 18, height: 18, borderRadius: 3,
                      backgroundColor: color.backgroundColor,
                      border: "1px solid rgba(0,0,0,.2)"
                    }} />
                    <strong style={{ color: color.backgroundColor }}>{color.name}</strong>
                  </span>
                : String(selected || "Choose a color");
            }
          }
        }}
      >
        <MenuItem value=""><em>No color selected</em></MenuItem>
        {colors.map(color => (
          <MenuItem key={color.id} value={color.id}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap"
            }}>
              <span aria-hidden style={{
                width: 22, height: 22, borderRadius: 3,
                backgroundColor: color.backgroundColor,
                border: "1px solid rgba(0,0,0,.2)"
              }} />
              <strong style={{ color: color.backgroundColor }}>{color.name}</strong>
              <span>({color.backgroundColor})</span>
              {usedBy[color.id] &&
                <em style={{ opacity: 0.7 }}>— also used by {joinNames(usedBy[color.id])}</em>}
            </span>
          </MenuItem>
        ))}
      </TextField>
      {sharedWith.length > 0 &&
        <Alert severity="warning" style={{ marginTop: 8 }}>
          {joinNames(sharedWith)} already {sharedWith.length === 1 ? "uses" : "use"} this color. Shops that share a
          color look the same on the maps and in Google Calendar. You can keep it, or pick another.
        </Alert>}
      {loading && <CircularProgress size={16} style={{ marginTop: 6 }} />}
      {error && <Alert severity="warning" style={{ marginTop: 8 }}>{error}</Alert>}
    </>
  );
};

export default ShopColorField;
