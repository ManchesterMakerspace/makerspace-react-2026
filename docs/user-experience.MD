# User experience and visual design standard

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

## Typography and fonts

No web font or custom `font-family` is loaded by this React bundle. MUI's
default typography therefore supplies the intended stack:

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
| Error | `#f44336` / MUI `error` | Invalid fields and errors |
| Warning | `#ff9800` / MUI `warning` | Warnings and attention states |
| Success | `#4caf50` / MUI `success` | Successful/active states |
| Informational blue | `#2196F3` | Legacy focused fields and promotion border |

Neutral surfaces also use MUI's default grey scale. Existing overlays use
translucent black or grey, such as `rgba(0, 0, 0, 0.35)` for a modal backdrop
and `rgba(200, 200, 200, 0.5)` for loading.

Some domain-specific or third-party visuals intentionally retain their own
colors: admin/board/resource-manager role badges (red, purple, and blue), Google
and Microsoft marks, PayPal/Venmo controls, credit-card brands, and analytics
charts. These are not general-purpose palette additions.

For new work:

1. Use semantic MUI theme values (`primary`, `secondary`, `error`, `warning`,
   `info`, `success`, `text.*`, `divider`, and `background.*`) rather than a new
   hex literal.
2. Use `secondary` for Manchester Makerspace brand emphasis and destructive
   actions only where that matches the surrounding established UI. Prefer
   MUI `error` for unambiguously destructive or failed states.
3. Never communicate status by color alone; pair it with text and/or an icon.
4. Maintain WCAG 2.1 AA contrast for text and interactive states, including
   focus, hover, selected, disabled, and error states.
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

The footer additionally uses the `material-symbols-rounded` CSS class for the
home, help center, calendar, chat, and mail glyphs. That font is not loaded by
this bundle and must be provided by the host page. Do not extend this secondary
set without first ensuring that the font is reliably supplied; prefer MUI icons
for new application controls.

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
