import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline, Paper, Typography } from '@mui/material';
import ToolGroupForm, { emptyGroup } from '../../../src/ui/toolCheckouts/ToolGroupForm';
import { Shop, Tool } from '../../../src/app/entities/toolCheckout';
const shops = [{ id: 'wood', name: 'Woodshop' }] as Shop[];
const tools = ['Bandsaw', 'Lathe', 'Orientation'].map((name, index) => ({ id: String(index), name, shopId: 'wood' })) as Tool[];
function Fixture() {
  const [value, setValue] = React.useState(emptyGroup('wood'));
  return <><CssBaseline /><Box sx={{ p: '12px', maxWidth: 800, mx: 'auto' }}>
    <Paper sx={{ p: 2 }}><Typography variant="h5" component="h1" sx={{ mb: 2 }}>Add group</Typography>
      <ToolGroupForm value={value} onChange={setValue} tools={tools} shops={shops} />
    </Paper>
  </Box></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
