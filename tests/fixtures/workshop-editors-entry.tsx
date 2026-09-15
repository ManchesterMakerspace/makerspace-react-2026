import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import WorkshopsPage from 'ui/workshops/WorkshopsPage';
import CheckoutRequestPage from 'ui/workshops/CheckoutRequestPage';
const role = new URLSearchParams(location.search).get('role') || 'admin';
const store = createStore(() => ({ auth: { currentUser: { id: 'viewer', role,
  isAdmin: role === 'admin', isBoardMember: role === 'board_member', isResourceManager: role === 'resource_manager',
  resourceManagerShopIds: ['shop'] } }, base: {} }));
createRoot(document.body.appendChild(document.createElement('div'))).render(
  <Provider store={store}><BrowserRouter><ThemeProvider theme={createTheme()}>
    <Box sx={{ px: '12px' }}><Routes>
      <Route path="/tools/:id/request-checkout" element={<CheckoutRequestPage />} />
      <Route path="*" element={<WorkshopsPage />} />
    </Routes></Box>
  </ThemeProvider></BrowserRouter></Provider>
);
