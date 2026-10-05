import * as React from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import { useTheme } from '@mui/material/styles';

// Page-wide defaults for everything that is not a MUI component.
//
// - The font and text color come from the theme. Without this the page itself
//   is the browser default (Times New Roman, pure black), so any plain HTML
//   outside MUI Typography -- lists, tables, bare text -- rendered in serif.
// - A plain link (an <a> with no class: MUI's Link and Button always have one)
//   uses the theme blue instead of the browser's default blue and purple.
// - The theme's status colors are published as CSS variables for the few
//   stylesheets (SCSS) that cannot read the theme.
//
// Deliberately not CssBaseline: that also resets margins and the page
// background, which the layout and the environment banner rely on.
const BaseStyles: React.FC = () => {
  const { palette, typography } = useTheme();
  return (
    <GlobalStyles
      styles={{
        ':root': {
          '--color-primary': palette.primary.main,
          '--color-success': palette.success.main,
          '--color-error': palette.error.main,
          '--color-warning': palette.warning.main,
          '--color-info': palette.info.main,
        },
        body: {
          fontFamily: typography.fontFamily,
          color: palette.text.primary,
        },
        'a:not([class])': { color: palette.primary.main },
        'a:not([class]):visited': { color: palette.primary.main },
      }}
    />
  );
};

export default BaseStyles;
