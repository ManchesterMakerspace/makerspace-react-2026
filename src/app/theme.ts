import { createTheme, Theme } from '@mui/material/styles';

// The only palette override is the Manchester Makerspace red-brown `secondary`.
// Status colors (success, error, warning, info) and the primary blue are MUI's
// defaults and are used everywhere through the theme -- `color="success"`,
// `sx={{ color: 'error.main' }}`, or the helpers in ui/common/statusColors --
// never as hex literals, so one change here changes them all.
export const theme: Theme = createTheme({
  palette: {
    secondary: {
      light: '#9E3321',
      main: '#791100',
      dark: '#510B00',
      contrastText: '#FFF',
    },
  },
});
