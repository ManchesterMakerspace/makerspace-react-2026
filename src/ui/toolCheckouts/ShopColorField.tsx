import * as React from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { GoogleCalendarColor } from "app/entities/toolCheckout";
import { listGoogleCalendarColors } from "api/toolCheckouts";

const FALLBACK_COLORS: GoogleCalendarColor[] = [
  ["Black", "#000000", "#ffffff"],
  ["Red", "#ff0000", "#ffffff"],
  ["Blue", "#0000ff", "#ffffff"],
  ["Green", "#008000", "#ffffff"],
  ["Yellow", "#ffff00", "#000000"],
  ["Orange", "#ffa500", "#000000"],
  ["Brown", "#a52a2a", "#ffffff"],
  ["Purple", "#800080", "#ffffff"],
  ["Gray", "#808080", "#ffffff"],
  ["Tan", "#d2b48c", "#000000"],
  ["Teal", "#008080", "#ffffff"],
].map(([name, backgroundColor, foregroundColor], index) => ({
  id: String(index + 1), name, backgroundColor, foregroundColor
}));

const ShopColorField: React.FC<{
  value?: string;
  onChange: (colorId: string) => void;
}> = ({ value = "", onChange }) => {
  const [colors, setColors] = React.useState<GoogleCalendarColor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

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
          onChange(available[0].id);
        }
      } else {
        setColors(FALLBACK_COLORS);
        setError(
          `${result.error?.message || "Google Calendar colors could not be loaded."} ` +
          "Using the fallback color palette."
        );
        if (!FALLBACK_COLORS.some(color => color.id === value)) {
          onChange(FALLBACK_COLORS[0].id);
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
        label="Shop calendar color"
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
              display: "inline-flex", alignItems: "center", gap: 8
            }}>
              <span aria-hidden style={{
                width: 22, height: 22, borderRadius: 3,
                backgroundColor: color.backgroundColor,
                border: "1px solid rgba(0,0,0,.2)"
              }} />
              <strong style={{ color: color.backgroundColor }}>{color.name}</strong>
              <span>({color.backgroundColor})</span>
            </span>
          </MenuItem>
        ))}
      </TextField>
      {loading && <CircularProgress size={16} style={{ marginTop: 6 }} />}
      {error && <Alert severity="warning" style={{ marginTop: 8 }}>{error}</Alert>}
    </>
  );
};

export default ShopColorField;
