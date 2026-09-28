import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline } from '@mui/material';
import Manager from '../../../src/ui/toolCheckouts/ToolCheckoutRequestsManager';
createRoot(document.getElementById('root')!).render(<><CssBaseline /><Box sx={{ p: '12px' }}><Manager canManage={false} /></Box></>);
