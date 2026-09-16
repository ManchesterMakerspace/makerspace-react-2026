import * as React from 'react';
import { Chip } from '@mui/material';
import { CheckoutApprover } from 'app/entities/toolCheckout';
import { toolAvailabilityLabel } from 'ui/common/ToolAvailability';

export default function ApproverTools({ approver }: { approver: Pick<CheckoutApprover, 'tools' | 'toolNames' | 'outOfServiceToolNames'> }) {
  const tools = approver.tools ?? approver.toolNames.map((name, index) => ({
    id: `legacy-${index}`, name, outOfService: approver.outOfServiceToolNames?.includes(name),
  }));
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
    {tools.map(tool => <Chip key={tool.id} label={toolAvailabilityLabel(tool)} size="small" variant="outlined" />)}
  </div>;
}
