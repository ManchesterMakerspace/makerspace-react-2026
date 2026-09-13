import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import FixBountyPage from 'ui/fixTickets/FixBountyPage';
import FixTicketsPage from 'ui/fixTickets/FixTicketsPage';
import TicketLimitSetting from 'ui/fixTickets/TicketLimitSetting';
const EditTaskModal = React.lazy(() => import('ui/volunteer/AdminVolunteerPage').then(module => ({ default: module.EditTaskModal })));
import { adminUpdateVolunteerTask } from 'api/volunteer';
const editTask = { id: 'credit-task', title: 'Repair', description: 'Replace switch', creditValue: 1, status: 'available', ticketId: 'ticket', prerequisiteToolIds: [] } as any;
createRoot(document.body.appendChild(document.createElement('div'))).render(
  <BrowserRouter><ThemeProvider theme={createTheme({ palette: { secondary: { main: '#791100' } } })}>
    <Box sx={{ px: '12px' }}><React.Suspense fallback={<div>Loading</div>}><Routes><Route path="/edit-bounty" element={<EditTaskModal task={editTask} canEditCredits onClose={() => {}} onSave={(id, body) => { adminUpdateVolunteerTask({ id, body }); }} loading={false} error='' />} /><Route path="/ticket-limit" element={<TicketLimitSetting />} /><Route path="/volunteer/tasks/:id" element={<FixBountyPage />} /><Route path="/fix-tickets" element={<FixTicketsPage />} /><Route path="/fix-tickets/:id" element={<FixTicketsPage />} /></Routes></React.Suspense></Box>
  </ThemeProvider></BrowserRouter>
);
