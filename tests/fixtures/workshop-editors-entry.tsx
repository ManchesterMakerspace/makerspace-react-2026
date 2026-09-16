import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import ApproverTools from 'ui/toolCheckouts/ApproverTools';
import ToolAvailability from 'ui/common/ToolAvailability';
import WorkshopsPage from 'ui/workshops/WorkshopsPage';
import { RequestModal } from 'ui/toolCheckouts/ToolCheckoutRequestsManager';
import CheckoutRequestPage from 'ui/workshops/CheckoutRequestPage';
const role = new URLSearchParams(location.search).get('role') || 'admin';
const store = createStore(() => ({ auth: { currentUser: { id: 'viewer', role,
  isAdmin: role === 'admin', isBoardMember: role === 'board_member', isResourceManager: role === 'resource_manager',
  resourceManagerShopIds: ['shop'] } }, base: {} }));
createRoot(document.body.appendChild(document.createElement('div'))).render(
  <Provider store={store}><BrowserRouter><ThemeProvider theme={createTheme()}>
    <Box sx={{ px: '12px' }}><Routes>
      <Route path="/tools/:id/request-checkout" element={<CheckoutRequestPage />} />
      <Route path="/checkout-manager-dialog" element={<RequestModal target={{ id: 'tool', name: 'Lathe', shopName: 'Woodworking', outOfService: true } as any} onClose={() => {}} onSave={() => {}} loading={false} error="" />} />
      <Route path="/availability-regression" element={<><p><strong>Unavailable tool <ToolAvailability outOfService /></strong></p><ApproverTools approver={{ toolNames: ['Lathe', 'Saw'], outOfServiceToolNames: ['Lathe'] }} /></>} />
      <Route path="*" element={<WorkshopsPage />} />
    </Routes></Box>
  </ThemeProvider></BrowserRouter></Provider>
);
