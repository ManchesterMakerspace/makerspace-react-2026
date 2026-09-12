import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import FixTicketsPage from 'ui/fixTickets/FixTicketsPage';
createRoot(document.body.appendChild(document.createElement('div'))).render(
  <BrowserRouter><ThemeProvider theme={createTheme({ palette: { secondary: { main: '#791100' } } })}>
    <Box sx={{ px: '12px' }}><Routes><Route path="/fix-tickets" element={<FixTicketsPage />} /><Route path="/fix-tickets/:id" element={<FixTicketsPage />} /></Routes></Box>
  </ThemeProvider></BrowserRouter>
);
