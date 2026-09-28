import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline } from '@mui/material';
import Manager from '../../../src/ui/toolCheckouts/ToolCheckoutRequestsManager';
import { CheckoutModal } from '../../../src/ui/toolCheckouts/CheckoutRoster';
import { shops } from './mocks';
createRoot(document.getElementById('root')!).render(<><CssBaseline /><Box sx={{ p: '12px' }}>{location.search.includes('roster') ? <CheckoutModal shops={[]} allShops={shops as any} tools={[]}
  preselectedMember={{ id: 'trainee', name: 'Trainee' }} onClose={() => {}} onCheckout={() => {}} loading={false} error="" /> : <Manager canManage={false} />}</Box></>);
