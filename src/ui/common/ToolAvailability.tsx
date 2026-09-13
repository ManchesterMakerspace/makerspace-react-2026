import * as React from 'react';
import { Chip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
export const toolAvailabilityLabel = (tool: { name: string; outOfService?: boolean }) =>
  `${tool.name}${tool.outOfService ? ' - Out of service' : ''}`;
const ToolAvailability: React.FC<{ outOfService?: boolean }> = ({ outOfService }) => outOfService
  ? <Chip size="small" color="warning" variant="outlined" icon={<WarningAmberIcon />} label="Out of service" /> : null;
export default ToolAvailability;
