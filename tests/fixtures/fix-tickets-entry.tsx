import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, Box } from '@mui/material';
import FixBountyPage from 'ui/fixTickets/FixBountyPage';
import FixTicketsPage from 'ui/fixTickets/FixTicketsPage';
import TicketLimitSetting from 'ui/fixTickets/TicketLimitSetting';
import ShopResourceManagersField from 'ui/toolCheckouts/ShopResourceManagersField';
import { CheckoutModal } from 'ui/toolCheckouts/CheckoutRoster';
const ToolNameFixture = React.lazy(() => import('ui/toolCheckouts/ToolManager').then(module => ({ default: function ToolNames({ edit }: { edit?: boolean }) {
  const [saved, setSaved] = React.useState(false);
  const tools = [{ id: 'one', name: 'Saw', shopId: 'shop' }, { id: 'two', name: 'Drill', shopId: 'shop', disabled: true }, { id: 'three', name: 'Lathe', shopId: 'other' }] as any;
  return <>{saved && <div>Tool accepted</div>}{edit
    ? <module.EditToolRow tool={tools[0]} tools={tools} shops={[{ id: 'shop', name: 'Shop' }] as any} onSave={() => setSaved(true)} onCancel={() => {}} saving={false} />
    : <module.AddToolModal shops={[{ id: 'shop', name: 'Shop' }] as any} tools={tools} onClose={() => {}} onSave={() => setSaved(true)} loading={false} error='' />}</>;
} })));
function CheckoutPickerFixture() {
  return <CheckoutModal shops={[{ id: 'shop', name: 'Workshop' }] as any}
    tools={[{ id: 'broken', name: 'Drill', shopId: 'shop', outOfService: true }, { id: 'working', name: 'Saw', shopId: 'shop' }] as any}
    preselectedMember={{ id: 'member', name: 'Member' }} loading={false} error='' onClose={() => {}} onCheckout={() => {}} />;
}
function ShopManagersFixture() {
  const [value, setValue] = React.useState([{ id: 'rm-one', name: 'First Manager' }]);
  return <ShopResourceManagersField value={value} onChange={setValue} />;
}
const EditTaskModal = React.lazy(() => import('ui/volunteer/AdminVolunteerPage').then(module => ({ default: module.EditTaskModal })));
const BountySettingFixture = React.lazy(() => import('ui/admin/MemberPortalSettings').then(module => ({ default: function BountySetting() {
  const [value, setValue] = React.useState('2');
  const attempt = React.useRef(0);
  return <module.SettingRow label='Max Credits for Ticket Bounties' settingKey='ticket_bounty_max_credit'
    value={value} saving={false} validate={module.validateTicketBountyLimit} onSave={async (_, next) => {
      if (attempt.current++ === 0) throw new Error('Network unavailable. Please retry.');
      setValue(next);
    }} />;
} })));
import { adminUpdateVolunteerTask } from 'api/volunteer';
const editTask = { id: 'credit-task', title: 'Repair', description: 'Replace switch', creditValue: 1, status: 'available', ticketId: 'ticket', prerequisiteToolIds: [] } as any;
if (new URLSearchParams(window.location.search).has('recurring')) {
  Object.assign(editTask, { status: 'recurring', days: 7, ticketId: undefined });
}
createRoot(document.body.appendChild(document.createElement('div'))).render(
  <BrowserRouter><ThemeProvider theme={createTheme({ palette: { secondary: { main: '#791100' } } })}>
    <Box sx={{ px: '12px' }}><React.Suspense fallback={<div>Loading</div>}><Routes><Route path="/tool-name/new" element={<ToolNameFixture />} /><Route path="/tool-name/edit" element={<ToolNameFixture edit />} /><Route path="/checkout-picker" element={<CheckoutPickerFixture />} /><Route path="/bounty-setting" element={<BountySettingFixture />} /><Route path="/shop-managers" element={<ShopManagersFixture />} /><Route path="/edit-bounty" element={<EditTaskModal task={editTask} canEditCredits onClose={() => {}} onSave={(id, body) => { adminUpdateVolunteerTask({ id, body }); }} loading={false} error='' />} /><Route path="/ticket-limit" element={<TicketLimitSetting />} /><Route path="/volunteer/tasks/:id" element={<FixBountyPage />} /><Route path="/fix-tickets" element={<FixTicketsPage />} /><Route path="/fix-tickets/:id" element={<FixTicketsPage />} /></Routes></React.Suspense></Box>
  </ThemeProvider></BrowserRouter>
);
