import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline } from '@mui/material';
import Manager from '../../../src/ui/toolCheckouts/ToolCheckoutRequestsManager';
import { CheckoutModal } from '../../../src/ui/toolCheckouts/CheckoutRoster';
import { shops } from './mocks';
import CheckoutApproversManager, { ApproverModal } from '../../../src/ui/toolCheckouts/CheckoutApproversManager';
import GroupApproval from '../../../src/ui/toolCheckouts/GroupApproval';
import { groups } from './mocks';
import ToolGroupList from '../../../src/ui/toolCheckouts/ToolGroupList';
const done = () => { document.getElementById('outcome')!.textContent = 'Saved'; };
const dialog = location.search.includes('catalog') ? <ToolGroupList shops={shops as any} tools={[]} />
  : location.search.includes('scopes') ? <CheckoutApproversManager />
  : location.search.includes('approver') ? <ApproverModal shops={shops as any} tools={[]} existing={{ id: 'assignment', memberId: 'trainee', memberName: 'Trainee', shopIds: [], toolIds: [], toolGroupIds: ['wood-group'] } as any} onClose={() => {}} onSave={done} loading={false} error="" />
  : location.search.includes('resolve') ? <GroupApproval group={groups[0] as any} memberId="trainee" requestId="request" onClose={() => {}} onSaved={done} />
  : location.search.includes('roster') ? <CheckoutModal shops={[]} allShops={shops as any} tools={[]}
    preselectedMember={{ id: 'trainee', name: 'Trainee' }} onClose={() => {}} onCheckout={() => {}} loading={false} error="" />
  : <Manager canManage={false} />;
createRoot(document.getElementById('root')!).render(<><CssBaseline /><Box sx={{ p: '12px' }}>{dialog}<div id="outcome" /></Box></>);
