import * as React from 'react';
import Typography from '@mui/material/Typography';

import { AuditLog } from 'api/auditLogs';
import { adminListAuditLogs, adminListAuditLogFilters } from 'api/auditLogs';
import { Column } from 'ui/common/table/Table';
import { SortDirection } from 'ui/common/table/constants';
import StatefulTable from 'ui/common/table/StatefulTable';
import { useQueryContext, withQueryContext } from 'ui/common/Filters/QueryContext';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import extractTotalItems from 'ui/utils/extractTotalItems';
import { timeToDateAndTime } from 'ui/utils/timeToDate';
import AuditLogFilters, { DEFAULT_CATEGORY, eventTypeLabel } from './AuditLogFilters';
import AuditLogDetail from './AuditLogDetail';

const AuditLogsTable: React.FC = () => {
  const { params, setParam } = useQueryContext({
    category:  DEFAULT_CATEGORY,
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

  const { data: choices } = useReadTransaction(adminListAuditLogFilters, {});
  const categoryLabels = React.useMemo(
    () => Object.fromEntries((choices?.categories || []).map(option => [option.value, option.label])),
    [choices]
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
          {timeToDateAndTime(row.createdAt)}
        </Typography>
      ),
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: 'eventType',
      label: 'Event',
      cell: (row: AuditLog) => (
        <>
          <Typography variant='body2'>{eventTypeLabel(row.eventType)}</Typography>
          {categoryLabels[row.category] && (
            <Typography variant='caption' color='textSecondary'>{categoryLabels[row.category]}</Typography>
          )}
        </>
      ),
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

  const renderExpandedContent = React.useCallback(
    (log: AuditLog) => <AuditLogDetail log={log} />,
    []
  );

  return (
    <>
      <AuditLogFilters onChange={refresh} choices={choices} />

      <StatefulTable
        id='audit-logs-table'
        title='Audit Log'
        loading={isRequesting}
        data={data}
        error={error}
        columns={columns}
        rowId={rowId}
        totalItems={extractTotalItems(response)}
        expandedRowId={expandedId}
        renderExpandedContent={renderExpandedContent}
      />
    </>
  );
};

export default withQueryContext(AuditLogsTable);
