# User experience and visual design standard

## Tool group controls

Add Tool dialogs in Workshops and tool management share the same component and
begin with Tool/Group radio buttons, defaulting to Tool. Workshop resource loading
shows an in-dialog Retry resources action on failure; retry reloads both tools and
managed shops, clears stale errors and shows loading before reopening the form. Group create/edit uses
`ToolGroupForm`: a name, optional description, disjoint physical-tool selectors,
Requestable/Reservable/Announce flags and optional announcement channel.
Groups follow individual tools and carry a Group chip. Group details reuse each
child's wiki/Drive links, annotation and authorized notes; group records do not
copy restricted child content. Group approval displays the current revision's
held/proposed checkouts and prerequisites, and stale submissions require reopening
the review. Group delete explains that open requests are cancelled while saved
checkouts and reservations remain.
Available checkout tools and groups share one filtered, sorted and paginated
catalog, with physical tools preceding groups. The group overview shows loading
and retry on failure, and clears load errors when automatic refresh recovers.
Approver tables show explicit named group assignments with Group chips in an
Authorized Groups column, separately from effective tool grants. Selecting a whole
shop clears its selected individual tools and groups; removing the shop does not
restore those independent grants. Group catalog loads in checkout
and approver-scope dialogs expose a loading state and recoverable error with Retry
tool groups; submission stays disabled until the catalog is complete. An all-held
group review with an open request offers Resolve request without new checkouts.
Group approval review loading is visible within the dialog; load failures appear
immediately with Retry review, independent of form edits. Retrying clears the old
error and keeps approval disabled until a fresh review arrives. Stale-revision
conflicts offer the same recovery.
The Available Tools shop selector defaults to All shops and scopes both tool and
group requests on the server; changing shops clears the selected resource and
resets pagination. Search and pagination then apply to the combined scoped catalog.
Saved reservation group snapshots remain visible on ordinary edits; changing resources drops groups that are no
longer selectable from the new selection.

This document records the user-interface conventions currently used by the
Manchester Makerspace member portal. It is both an inventory of the existing
application and the standard to follow when adding or changing UI.

## Design foundation

The application uses [Material UI (MUI)](https://mui.com/material-ui/) as its
component and theme foundation. Prefer MUI components, their documented
variants, and the application theme over one-off HTML and CSS. The interface is
deliberately functional and restrained: content is arranged in 12-column grids,
forms and administrative data are placed in `Paper`, `Card`, tables, and modal
dialogs, and actions use familiar Material buttons and icons.

The persistent visual elements are:

- a light, static MUI `AppBar` with the Manchester Makerspace logo, contextual
  help, account identity, and a compact menu;
- content with 12 px horizontal page padding;
- a centered footer containing icon links to the public site, wiki, calendar,
  Slack, and email;
- the Manchester Makerspace gear/logo SVGs in `src/assets`, including a
  rotating outline and interior mark for loading states;
- MUI elevation on cards, menus, dialogs, and papers, supplemented by subtle
  custom shadows on membership promotions, payment cards, loading overlays,
  and sign-up feedback; and
- rounded corners, generally 4 px for legacy cards and controls and up to
  12–16 px for the sign-up notification sheet.

Use spacing values from MUI or the established 4/8 px rhythm where possible.
Keep related actions together, put the primary action first, and use clear
labels. Icons must reinforce—not replace—an accessible text label unless an
icon-only control has an `aria-label` and tooltip/title.

Editor save actions use MUI's `medium` icon-button and icon sizes on desktop so
the primary commit control remains prominent and has a comfortable target.

## Typography and fonts

No web font or custom `font-family` is loaded by this React bundle. MUI's
default typography supplies the intended stack, and `src/app/BaseStyles.tsx`
applies it (and the theme text color) to `body` so text outside a MUI component
does not fall back to the browser's serif default:

```text
Roboto, Helvetica, Arial, sans-serif
```

Roboto is the preferred face, while Helvetica, Arial, or the available system
sans-serif renders when Roboto is not supplied by the embedding application or
user device. Do not introduce a new typeface or add a remote font dependency
for an isolated feature.

Use MUI `Typography` variants to preserve hierarchy and responsive behavior:

- page titles: `h4` or the existing page-level heading variant;
- section and card titles: `h5`/`h6` as appropriate;
- introductory copy: `subtitle1` where established;
- ordinary labels and content: `body1` or `body2`; and
- supplementary state or metadata: `caption`.

Existing exceptions include 16 px hosted payment fields, 11 px uppercase card
labels, 10 px bold uppercase-style role chips, and relative `em` sizing in the
legacy payment form. Preserve these when maintaining those features, but use
MUI typography for new work. Do not encode hierarchy with size or weight alone;
use semantic headings in order.

## Color choices

The application uses MUI's default light theme. The only theme override is the
Manchester Makerspace red-brown `secondary` palette:

| Role | Color | Current use |
| --- | --- | --- |
| Primary main | `#1976d2` | MUI default primary actions, links, focus, and selection |
| Secondary light | `#9E3321` | Light secondary emphasis |
| Secondary main | `#791100` | Brand/action emphasis |
| Secondary dark | `#510B00` | Dark secondary emphasis |
| Secondary contrast | `#FFFFFF` | Text/icons on secondary surfaces |
| Text primary | `rgba(0, 0, 0, 0.87)` | Main copy and hosted input text |
| Text secondary | `rgba(0, 0, 0, 0.54)` | Supporting and filled-field labels |
| Divider/input border | `rgba(0, 0, 0, 0.26)` | Legacy input rules |
| Surface | `#FFFFFF` | Papers, cards, forms, and notifications |
| Error main | `#d32f2f` | MUI `error.main`; invalid fields, failures, and destructive states |
| Warning main | `#ed6c02` | MUI `warning.main`; warnings and attention states |
| Info main | `#0288d1` | MUI `info.main`; neutral informational states |
| Success main | `#2e7d32` | MUI `success.main`; successful and active states |

Neutral surfaces also use MUI's default grey scale. Existing overlays use
translucent black or grey, such as `rgba(0, 0, 0, 0.35)` for a modal backdrop
and `rgba(200, 200, 200, 0.5)` for loading.

Status colors are read from the theme (`src/app/theme.ts`) everywhere; do not
write a status color as a hex literal. Use a MUI `color` prop, a theme path such
as `success.main` in `sx`, or the helpers in `src/ui/common/statusColors.ts`:
`softTone(tone)` for chips and badges, `toneNotice(tone)` for inline callouts,
`infoBoxSx`/`warningBoxSx` for the rental-page callouts, and
`ROLE_BADGE_COLORS` for role badges. `BaseStyles` also publishes
`--color-primary`, `--color-success`, `--color-error`, `--color-warning`, and
`--color-info` CSS variables for SCSS that cannot reach the theme.

Raw `<a>` elements without a class use the theme's primary blue (not the
browser default) through the same base styles; MUI `Link`/`Button` keep their
own styling.

Some domain-specific or third-party visuals intentionally retain their own
colors: the board-member badge purple, Google, Slack, and Microsoft marks,
PayPal/Venmo controls, and credit-card brands. Floor-map colors are controlled
by the Google Calendar color palette, not by this theme. These are not
general-purpose palette additions.

For new work:

1. Use semantic MUI theme values (`primary`, `secondary`, `error`, `warning`,
   `info`, `success`, `text.*`, `divider`, and `background.*`) rather than a new
   hex literal.
2. Use `secondary` for Manchester Makerspace brand emphasis and destructive
   actions only where that matches the surrounding established UI. Prefer
   MUI `error` for unambiguously destructive or failed states.
3. Never communicate status by color alone; pair it with text and/or an icon.
4. Maintain WCAG 2.1 AA contrast for text and enabled interactive states,
   including focus, hover, selected, and error states. Inactive controls are
   exempt from the WCAG contrast criteria and may retain MUI's default
   reduced-opacity disabled styling.
5. Keep official third-party brand colors isolated to that provider's mark or
   branded control.

## Icons and imagery

The primary icon set is `@mui/icons-material`, using filled or outlined
Material icons already present in the application. Common symbols include
add, edit, delete, save, cancel/close, check, warning/error/info, menu, filter,
security/lock, visibility, send, refresh, back, QR code, event, assignment, and
construction. Import an icon directly from its package path to preserve tree
shaking, for example:

```tsx
import AddIcon from "@mui/icons-material/Add";
```

The footer uses bundled MUI SVG icons for home, help center, calendar, chat, and
mail. Its glyphs require neither a host-provided icon font nor a remote font
request, including in the packaged native application.

Brand imagery consists of the SVG files in `src/assets` and `favicon.png`.
Reuse these assets rather than redrawing the logo. Always give meaningful
images alternative text; decorative images should use empty alternative text.
Do not use emoji as application icons. Keep icon size aligned with MUI's
`small`, `medium`, or `large` sizing and the adjacent typography.

## Responsive design

The UI is mobile-first and primarily uses MUI `Grid` and responsive `sx`
properties. MUI's default breakpoints are the shared vocabulary:

| Breakpoint | Minimum width | Typical behavior |
| --- | ---: | --- |
| `xs` | 0 px | Single-column/mobile layout; controls and content may use all 12 columns |
| `sm` | 600 px | Split forms and summary fields into practical columns |
| `md` | 900 px | Center main content at roughly 10 columns or create two-column layouts |
| `lg` | 1200 px | Allow wider desktop presentation where needed |
| `xl` | 1536 px | MUI default; currently rarely needed |

The credit-card form has one legacy custom breakpoint at 476 px. The sign-up
feedback notification uses a 600 px media query: it is a bottom sheet on small
screens and a bottom-right floating panel otherwise. The landing-page logo is
hidden at `xs`, while page content and calls to action remain available.

When implementing responsive behavior:

- start at `xs`, then add only the `sm`/`md` overrides the layout needs;
- use MUI breakpoints and responsive `sx`/`Grid` props instead of adding an
  arbitrary media query;
- stack form fields and action groups when their labels or targets would become
  cramped, and allow tables to scroll horizontally rather than clipping data;
- avoid fixed content widths; use `width: 100%`, `maxWidth`, grid columns, and
  intrinsic sizing. A fixed minimum or width is acceptable only for an
  established specialized widget with a mobile override;
- keep primary content within the existing 12 px page gutter and use the MUI
  spacing scale for internal gaps;
- test at 320 px, the `sm` boundary (600 px), the `md` boundary (900 px), and a
  representative desktop width; and
- account for touch targets, zoomed text, long names, validation messages,
  reduced-motion preferences, keyboard focus, and mobile safe-area insets.

## Interaction, feedback, and accessibility

Shop editing in `/workshops` reuses `EditShopModal` from `/tool-checkouts`.
Tool creation and editing in both catalogs use `ToolEditorModal`, with the same
fields, validation, and save behavior, including the pending-member checkbox. Load complete, permission-scoped management records before
rendering these forms; do not seed them from workshop summaries or introduce
separate reduced edit forms. Shop managers see service status and edit controls
for their shops and tools.

- Use contained buttons for the main action and outlined/text buttons for
  secondary actions. Use icon buttons only for universally understood actions.
- Display asynchronous work with MUI progress indicators or the branded loading
  mark. Disable repeat submission while an action is pending.
- Use MUI alerts, helper text, status chips, and the existing toast/feedback
  patterns. State what happened and, for errors, how the user can recover.
- Preserve visible keyboard focus and logical tab order. Every form input needs
  an associated label, and every dialog needs an accessible title.
- Respect semantic HTML beneath MUI components. Do not make a non-interactive
  element clickable when a button or link expresses the behavior.
- Animations should be brief and purposeful. New animation must honor
  `prefers-reduced-motion`.

## Floor maps

Shop and tool locations are drawn on a [Leaflet](https://leafletjs.com/) map
(`FloorMap`, used by `ShopLocationMap` and `ShopMapView`) over the floor-plan
SVGs in `app/assets/images/shopFloorPlans` (`floor-B`, `floor-1`, `floor-2`).
The plan is a plain image, so positions are stored as percentages of it and
`floorMapGeometry.ts` is the only place they are converted to map coordinates.

- A shop can span floors: each location has its own floor (defaulting to the
  shop's home floor), and a floor switch appears when more than one applies.
- Editors get a mode toolbar (Select, Add marker, Draw area). Nothing is
  created unless a mode is chosen, so a stray click never drops a marker. In
  Select mode, click an area or marker to choose it and see its details; drag
  the chosen marker to move it, or its red corner points to reshape the area.
  A small dot at the middle of each edge adds a corner when dragged, and
  double-clicking (or right-clicking / long-pressing) a corner removes it; a
  shape always keeps at least three. Each drag saves when released. A marker placed or moved inside an area is
  nested in it automatically (the smallest area containing it); the "Inside"
  field in the form shows and can change this. Everything is also reachable
  from the keyboard through the list under the map, which selects an item.
  Hints and messages sit below the map so changing text never moves it.
- Markers use a fixed set of MUI glyphs (`markerIcons.tsx`, mirrored by
  `Location::ICONS` on the server). A glyph is never the only label: every
  interactive marker has a name as its tooltip and accessible label, and is
  reachable and activatable from the keyboard. Shaded areas are mouse/touch
  targets; the hierarchy list beneath the map names everything on them.
- The map has a fixed height that shrinks on narrow screens
  (`min(420px, 90vw)`), a documented exception to the no-fixed-size guidance
  because a map needs a definite height. The page does not capture the scroll
  wheel; zoom with the +/- buttons, pinch, or double-click.
- On the Workshops Tools tab, each tool's location line carries the map
  action beside it: "Find tool" (zooms the map to the tool, rings it and
  labels it) when the tool has a spot, or "Place on map" (resource managers
  and above) when it does not, which opens the map ready to place that tool.
  Anything saved on the map refreshes the page's data, so the Tools tab never
  lags behind the map.
- Shop colors are Google Calendar's 11 event colors, so shops can share one.
  The color picker offers every color, marks the ones other shops already use,
  and warns (without blocking) when a shared color is chosen: shops that share
  a color look the same on the maps and in Google Calendar.
- The "find this tool" pulse is disabled under `prefers-reduced-motion`.
- Leaflet's stylesheet is bundled as a string (`asset/source` rule in the
  webpack configs) and injected once, instead of going through the Rails
  stylesheet pipeline.

## Checklist for UI changes

Before considering a UI change complete, confirm that it:

- uses MUI components, typography, spacing, palette roles, and icons where
  possible;
- is usable without color or an icon being the only label;
- works with keyboard navigation and exposes useful accessible names;
- handles loading, empty, success, validation, and failure states;
- fits at mobile and desktop widths without clipped content;
- reuses the existing logo and visual language rather than inventing a parallel
  style; and
- updates this document when deliberately changing the shared standard.
