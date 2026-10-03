import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlaceIcon from "@mui/icons-material/Place";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShelvesIcon from "@mui/icons-material/Shelves";
import InboxIcon from "@mui/icons-material/Inbox";
import TableBarIcon from "@mui/icons-material/TableBar";
import CarpenterIcon from "@mui/icons-material/Carpenter";
import ConstructionIcon from "@mui/icons-material/Construction";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import MemoryIcon from "@mui/icons-material/Memory";
import HandymanIcon from "@mui/icons-material/Handyman";
import SettingsIcon from "@mui/icons-material/Settings";

// Marker glyphs a location can use. Keep the keys in step with
// Location::ICONS on the server -- anything else is rejected there. Blank
// (or an unknown key) draws the default pin.
export const MARKER_ICONS: { value: string; label: string; Icon: React.ElementType }[] = [
  { value: "pin", label: "Pin", Icon: PlaceIcon },
  { value: "cabinet", label: "Cabinet", Icon: Inventory2Icon },
  { value: "shelf", label: "Shelf", Icon: ShelvesIcon },
  { value: "drawer", label: "Drawer", Icon: InboxIcon },
  { value: "workbench", label: "Workbench", Icon: TableBarIcon },
  { value: "saw", label: "Saw / woodworking", Icon: CarpenterIcon },
  { value: "drill", label: "Drill / power tool", Icon: ConstructionIcon },
  { value: "printer", label: "3D printer", Icon: ViewInArIcon },
  { value: "laser", label: "Laser", Icon: ElectricBoltIcon },
  { value: "welder", label: "Welder / torch", Icon: WhatshotIcon },
  { value: "sewing", label: "Sewing / textiles", Icon: CheckroomIcon },
  { value: "electronics", label: "Electronics", Icon: MemoryIcon },
  { value: "hand_tools", label: "Hand tools", Icon: HandymanIcon },
  { value: "lathe", label: "Lathe / mill", Icon: SettingsIcon },
];

const ICON_BY_KEY = new Map(MARKER_ICONS.map(i => [i.value, i.Icon]));

export const markerIconLabel = (key?: string) => MARKER_ICONS.find(i => i.value === key)?.label;

export const MARKER_SIZE = 32;

// Static HTML for a Leaflet divIcon: a colored round badge with a white
// glyph. Rendered once per marker, not a live React tree.
export const markerHtml = (key: string | undefined, color: string, highlighted = false) => {
  const Icon: React.ElementType = (key ? ICON_BY_KEY.get(key) : undefined) || PlaceIcon;
  const glyph = renderToStaticMarkup(<Icon style={{ width: 20, height: 20, fill: "#fff" }} />);
  const ring = highlighted ? '<span class="floor-map-ring"></span>' : "";
  return `<div class="floor-map-marker" style="background:${color}">${glyph}</div>${ring}`;
};
