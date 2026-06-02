import * as React from 'react';
import Typography from '@mui/material/Typography';

import AuditLogsTable from './AuditLogsTable';

const AuditLogPage: React.FC = () => (
  <>
    <Typography variant='h6' gutterBottom>
      Audit Log
    </Typography>
    <AuditLogsTable />
  </>
);

export default AuditLogPage;
