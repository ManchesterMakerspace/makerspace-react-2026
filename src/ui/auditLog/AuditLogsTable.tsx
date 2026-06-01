import * as React from 'react';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';

import { AuditLog } from 'api/auditLogs';
import { adminListAuditLogs } from 'api/auditLogs';
import { Column } from 'ui/common/table/Table';
import { SortDirection } from 'ui/common/table/constants';
import StatefulTable from 'ui/common/table/StatefulTable';
import { useQueryContext, withQueryContext } from 'ui/common/Filters/QueryContext';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import extractTotalItems from 'ui/utils/extractTotalItems';
import { timeToDate } from 'ui/utils/timeToDate';
import { EVENT_TYPE_OPTIONS } from './AuditLogFilters';
import AuditLogFilters from './AuditLogFilters';
import AuditLogDetail from './AuditLogDetail';

const friendlyEventType = (eventType: string): string =>
  EVENT_TYPE_OPTIONS[eventType] || eventType;

const AuditLogsTable: React.FC = () => {
  const { params, setParam } = useQueryContext({
    logType:   undefined,
    eventType: undefined,
    actorId:   undefined,
    subjectId: undefined,
    fromDate:  undefined,
    toDate:    undefined,
  });

  const [expandedId, setExpandedId] = React.useState<string | undefined>(undefined);

  const { isRequesting, error, data = [], response, refresh } = useReadTransaction(
    adminListAuditLogs,
    params
  );

  const rowId = React.useCallback((log: AuditLog) => log.id, []);

  const handleSelect = React.useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? undefined : id));
  }, []);

  const columns: Column<AuditLog>[] = [
    {
      id: 'createdAt',
      label: 'Date / Time',
      cell: (row: AuditLog) => (
        <Typography variant='body2' style={{ whiteSpace: 'nowrap' }}>
          {timeToDate(row.createdAt)}
        </Typography>
      ),
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: 'eventType',
      label: 'Event',
      cell: (row: AuditLog) => friendlyEventType(row.eventType),
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: 'actorName',
      label: 'Changed By',
      cell: (row: AuditLog) => row.actorName || <Typography variant='body2' color='textSecondary'>System</Typography>,
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: 'subjectName',
      label: 'Member Affected',
      cell: (row: AuditLog) => row.subjectName || <Typography variant='body2' color='textSecondary'>—</Typography>,
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: 'slackMessage',
      label: 'Summary',
      cell: (row: AuditLog) => (
        <Typography variant='body2' style={{ maxWidth: 420 }}>
          {row.slackMessage}
        </Typography>
      ),
    },
    {
      id: 'detail',
      label: '',
      cell: (row: AuditLog) => (
        <Typography
          variant='body2'
          color='primary'
          style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleSelect(row.id);
          }}
        >
          {expandedId === row.id ? 'Hide detail ▲' : 'Show detail ▼'}
        </Typography>
      ),
    },
  ];

  // Inject expanded detail rows after each matching row
  const dataWithExpansions = React.useMemo(() => data, [data]);

  return (
    <>
      <AuditLogFilters onChange={refresh} />

      <StatefulTable
        id='audit-logs-table'
        title='Audit Log'
        loading={isRequesting}
        data={dataWithExpansions}
        error={error}
        columns={columns}
        rowId={rowId}
        totalItems={extractTotalItems(response)}
        selectedIds={expandedId}
        setSelectedIds={handleSelect}
      />

      {/* Render detail expansion below the table for the selected row */}
      {expandedId && (() => {
        const log = data.find(l => l.id === expandedId);
        return log ? (
          <Collapse in={true} timeout='auto' unmountOnExit>
            <AuditLogDetail log={log} />
          </Collapse>
        ) : null;
      })()}
    </>
  );
};

export default withQueryContext(AuditLogsTable);
