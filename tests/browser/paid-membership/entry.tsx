import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline, Typography } from '@mui/material';
import ContinuousPaidMembership from '../../../src/ui/member/ContinuousPaidMembership';
const root = createRoot(document.getElementById('root')!);
let renderNumber = 0;
(window as any).renderFixture = (role = 'admin', mode = '') => {
  (window as any).fixtureUser = { id: role === 'self' || role === 'rmSelf' ? 'subject' : role,
    isAdmin: role === 'admin', isBoardMember: role === 'board', isResourceManager: role === 'rm' || role === 'rmSelf' };
  (window as any).fixtureState = { mode, reads: 0,
    balance: { continuousPaidMembershipMonths: 11, revision: 7, estimated: true } };
  root.render(<><CssBaseline /><Box sx={{ p: 1.5, maxWidth: 800, mx: 'auto' }}>
    <Typography component="h1" variant="h5">Test Member</Typography>
    <ContinuousPaidMembership key={++renderNumber} member={{ id: 'subject', status: mode === 'revoked' ? 'revoked' : 'activeMember', expirationTime: Date.now() + 86400000 }} />
  </Box></>);
};
(window as any).renderFixture();
