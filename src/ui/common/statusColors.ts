import { alpha, SxProps, Theme } from '@mui/material/styles';

// One set of status colors for the whole app. Every one of these reads the
// theme (src/app/theme.ts), so "success" is the same green in a chip, an icon,
// a notice and a chart, and changing the theme changes them all. Do not write
// a status color as a hex literal; use these, a MUI `color` prop, or a theme
// path such as 'success.main'.

export type Tone = 'success' | 'error' | 'warning' | 'info';

// A soft chip or badge: a pale tint of the tone with dark text of the same
// tone (readable on the tint). Use as `<Chip sx={softTone('success')} />`.
export const softTone = (tone: Tone) => (theme: Theme) => ({
  backgroundColor: alpha(theme.palette[tone].main, 0.12),
  color: theme.palette[tone].dark,
  '& .MuiChip-icon': { color: 'inherit' },
});

// An inline callout that is not worth a full Alert: a pale tint with a matching
// border. Use as `<Box sx={[toneNotice('warning'), { p: 1 }]}>`.
export const toneNotice = (tone: Tone) => (theme: Theme) => ({
  backgroundColor: alpha(theme.palette[tone].main, 0.08),
  border: `1px solid ${alpha(theme.palette[tone].main, 0.4)}`,
  borderRadius: 1,
});

// The standard callout boxes used on the rental pages (and the compact variants
// on the admin rental screens). Use as `<Typography sx={infoBoxSx}>`.
export const infoBoxSx: SxProps<Theme> = [toneNotice('info'), { p: '10px 14px', mb: 1.5, fontSize: '0.875rem' }];
export const warningBoxSx: SxProps<Theme> = [toneNotice('warning'), { p: '10px 14px', mb: 1, fontSize: '0.875rem' }];
export const compactInfoBoxSx: SxProps<Theme> = [toneNotice('info'), { mt: 1, p: 1 }];
export const compactWarningBoxSx: SxProps<Theme> = [toneNotice('warning'), { mt: 1, p: 1 }];

// Theme path for text or an icon in a tone, for `color=` and `sx={{ color }}`.
export const toneColor = (tone: Tone) => `${tone}.main`;

// The role badges in the header and on contact lists. Admin and resource
// manager are theme tones; board member has no theme equivalent, so its purple
// lives here once instead of being repeated in each place that draws a badge.
export const ROLE_BADGE_COLORS = {
  admin: (theme: Theme) => theme.palette.error.main,
  resource_manager: (theme: Theme) => theme.palette.primary.dark,
  board_member: () => '#7b1fa2',
  other: (theme: Theme) => theme.palette.grey[500],
} as const;
