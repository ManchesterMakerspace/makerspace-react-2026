import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, Box, Alert } from '@mui/material';
import ShopOutageAction from 'ui/workshops/ShopOutageAction';
function Fixture() {
  const [outOfService, setOutOfService] = React.useState(false);
  return <ThemeProvider theme={createTheme()}><Box sx={{ p: 2 }}>
    {outOfService && <Alert severity="warning">Shop out of service</Alert>}
    <ShopOutageAction shop={{ id: 'shop', name: 'Woodworking and fabrication workshop', outOfService } as any}
      onSaved={() => setOutOfService(value => !value)} />
  </Box></ThemeProvider>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Fixture />);
