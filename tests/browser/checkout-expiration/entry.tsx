import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline, Stack, Typography } from '@mui/material';
import { CheckoutExpirationActions, BulkCheckoutExpirationButton } from '../../../src/ui/toolCheckouts/CheckoutExpirationActions';
import { Tool, ToolCheckout } from '../../../src/app/entities/toolCheckout';
const row = { id: 'old', memberName: 'Test Member', toolId: 'saw', toolName: 'Woodshop bandsaw', expiresOn: '2020-01-01', expirationStatus: 'expired', expirationRevision: 7,
  canManageExpiration: true, canRenew: true, checkoutTrainingPlanUrl: 'https://example.com/training' } as ToolCheckout;
createRoot(document.getElementById('root')!).render(<><CssBaseline /><Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}><Stack spacing={2}>
<Typography component="h1" variant="h5">Checkout expiration</Typography>
<CheckoutExpirationActions checkout={row} onSaved={() => {}} />
<BulkCheckoutExpirationButton tool={{ id: 'saw', name: 'Woodshop bandsaw', canManageCheckoutExpiration: true } as Tool} onSaved={() => {}} />
</Stack></Box></>);
