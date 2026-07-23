import * as React from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { GoogleCalendarColor } from "app/entities/toolCheckout";
import { listGoogleCalendarColors } from "api/toolCheckouts";

const ShopColorField: React.FC<{
  value?: string;
  onChange: (colorId: string) => void;
}> = ({ value = "", onChange }) => {
  const [colors, setColors] = React.useState<GoogleCalendarColor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    listGoogleCalendarColors().then(result => {
      if (!active) return;
      if (result.data) {
        const available = result.data.colors.slice(0, 24);
        setColors(available);
        if (!value && available[0]) onChange(available[0].id);
      } else {
        setError(result.error?.message || "Google Calendar colors could not be loaded.");
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
          ? "Loading the first 24 Google Calendar colors…"
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
                    Google color {color.id}
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
              display: "inline-flex", alignItems: "center", gap: 8,
              color: color.foregroundColor
            }}>
              <span aria-hidden style={{
                width: 22, height: 22, borderRadius: 3,
                backgroundColor: color.backgroundColor,
                border: "1px solid rgba(0,0,0,.2)"
              }} />
              Color {color.id} ({color.backgroundColor})
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
