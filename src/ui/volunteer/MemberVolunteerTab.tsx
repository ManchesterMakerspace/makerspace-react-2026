import * as React from 'react';
import Grid from "@mui/material/Grid";
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckIcon from '@mui/icons-material/Check';
import EventIcon from '@mui/icons-material/Event';
import CancelIcon from '@mui/icons-material/Cancel';
import RepeatIcon from '@mui/icons-material/Repeat';
import { Member } from 'makerspace-ts-api-client';

import StatefulTable from 'ui/common/table/StatefulTable';
import { Column } from 'ui/common/table/Table';
import { SortDirection } from 'ui/common/table/constants';
import { withQueryContext } from 'ui/common/Filters/QueryContext';
import StatusLabel from 'ui/common/StatusLabel';
import { Status } from 'ui/constants';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';
import extractTotalItems from 'ui/utils/extractTotalItems';
import ErrorMessage from 'ui/common/ErrorMessage';

import { VolunteerCredit, VolunteerTask, VolunteerEvent, VolunteerSummary } from 'app/entities/volunteer';
import {
  getMemberVolunteerCredits,
  getVolunteerSummary,
  getMemberVolunteerTasks,
  getMyVolunteerClaims,
  getMemberVolunteerEvents,
  claimVolunteerTask,
  completeVolunteerTask,
  checkinVolunteerEvent,
  removeCheckinVolunteerEvent,
} from 'api/volunteer';

interface Props {
  member: Member;
}

const creditStatusLabel = (status: string): { label: string; color: Status } => {
  switch (status) {
    case 'approved':  return { label: 'Approved',          color: Status.Success };
    case 'pending':   return { label: 'Awaiting Approval', color: Status.Warn };
    case 'rejected':  return { label: 'Rejected',          color: Status.Danger };
    case 'reversal':  return { label: 'Reversed',          color: Status.Danger };
    default:          return { label: status,              color: Status.Default };
  }
};

const taskStatusLabel = (status: string): { label: string; color: Status } => {
  switch (status) {
    case 'available':  return { label: 'Available',            color: Status.Success };
    case 'claimed':    return { label: 'Claimed',              color: Status.Info };
    case 'pending':    return { label: 'Pending Verification', color: Status.Warn };
    case 'completed':  return { label: 'Completed',            color: Status.Primary };
    case 'cancelled':  return { label: 'Cancelled',            color: Status.Danger };
    case 'reusable':   return { label: 'Reusable',             color: Status.Success };
    case 'repeatable': return { label: 'Repeatable',           color: Status.Success };
    case 'recurring':  return { label: 'Recurring',            color: Status.Success };
    default:           return { label: status,                 color: Status.Default };
  }
};

// ── Credit History ────────────────────────────────────────────────────────────

const CreditHistoryInner: React.FC = () => {
  const { isRequesting, data: credits = [], response, error } =
    useReadTransaction(getMemberVolunteerCredits, {}, undefined, 'member-volunteer-credits');

  const columns: Column<VolunteerCredit>[] = [
    {
      id: 'description',
      label: 'Description',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerCredit) => (
        <div>
          <Typography variant='body2' style={{ color: row.status === 'reversal' ? '#c62828' : undefined }}>
            {row.description}
          </Typography>
          {row.taskTitle && (
            <Typography variant='caption' color='textSecondary'>Task: {row.taskTitle}</Typography>
          )}
          {row.status === 'reversal' && row.reversalReason && (
            <Typography variant='caption' color='error' style={{ display: 'block' }}>
              Reason: {row.reversalReason}
            </Typography>
          )}
          {row.reversed && (
            <Typography variant='caption' color='error' style={{ display: 'block' }}>
              This credit has been reversed
            </Typography>
          )}
        </div>
      ),
    },
    {
      id: 'creditValue',
      label: 'Credits',
      cell: (row: VolunteerCredit) => (
        <Typography variant='body2' style={{ color: row.creditValue < 0 ? '#c62828' : undefined }}>
          {row.creditValue > 0 ? `+${row.creditValue}` : row.creditValue}
        </Typography>
      ),
    },
    {
      id: 'date',
      label: 'Date',
      cell: (row: VolunteerCredit) => (
        <Typography variant='body2'>
          {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row: VolunteerCredit) => {
        const s = creditStatusLabel(row.status);
        return (
          <div>
            <StatusLabel label={s.label} color={s.color} />
            {row.discountApplied && !row.reversed && (
              <div><StatusLabel label='Discount Applied' color={Status.Primary} /></div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <StatefulTable
      id='member-volunteer-credits-table'
      title='Credit History'
      loading={isRequesting}
      data={credits as VolunteerCredit[]}
      error={error}
      columns={columns}
      rowId={(c: VolunteerCredit) => c.id}
      totalItems={extractTotalItems(response)}
      selectedIds={undefined}
      setSelectedIds={() => {}}
    />
  );
};

const CreditHistory = withQueryContext(CreditHistoryInner);

// ── My Active Claims ──────────────────────────────────────────────────────────
// Shows claimed/pending task documents the member owns, including child docs
// spawned from reusable/repeatable/recurring parent tasks.

interface MyClaimsProps {
  member: Member;
  onRefresh: () => void;
}

const MyClaimsInner: React.FC<MyClaimsProps> = ({ member, onRefresh }) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const { isRequesting, data: claims = [], response, error, refresh } =
    useReadTransaction(getMyVolunteerClaims, {}, undefined, 'member-volunteer-my-claims');

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setSelectedIds([]);
    refreshRef.current();
    onRefresh();
  }, [onRefresh]);

  const { call: markComplete, isRequesting: completing, error: completeError } =
    useWriteTransaction(completeVolunteerTask, onSuccess);

  const claimList = claims as VolunteerTask[];

  if (claimList.length === 0 && !isRequesting) return null;

  const selectedClaim = selectedIds.length === 1
    ? claimList.find(t => t.id === selectedIds[0])
    : null;

  const columns: Column<VolunteerTask>[] = [
    {
      id: 'title',
      label: 'Task',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerTask) => (
        <div>
          <Typography variant='body2'>
            <strong>{row.title}</strong>
            {row.isChildTask && (
              <Typography component='span' variant='caption' color='textSecondary'> (multi-use)</Typography>
            )}
          </Typography>
          <Typography variant='caption' color='textSecondary'>{row.description}</Typography>
          {row.shopName && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>{row.shopName}</Typography>
          )}
          {row.claimedAt && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              Claimed {new Date(row.claimedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          )}
        </div>
      ),
    },
    {
      id: 'creditValue',
      label: 'Credits',
      cell: (row: VolunteerTask) => <Typography variant='body2'>{row.creditValue}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row: VolunteerTask) => {
        const s = taskStatusLabel(row.status);
        return <StatusLabel label={s.label} color={s.color} />;
      },
    },
  ];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6'>My Active Claims</Typography>
        <Typography variant='body2' color='textSecondary'>
          Tasks you have claimed that are awaiting completion or verification.
        </Typography>
      </Grid>

      {selectedClaim?.status === 'claimed' && selectedClaim.claimedById === member.id && (
        <Grid size={{ xs: 12 }}>
          <Button variant='contained' color='primary' size='small'
            disabled={completing} startIcon={<CheckIcon />}
            onClick={() => markComplete({ id: selectedClaim.id })}>
            Mark Complete
          </Button>
          {completeError && <ErrorMessage error={completeError} />}
        </Grid>
      )}

      {selectedClaim?.status === 'pending' && (
        <Grid size={{ xs: 12 }}>
          <Typography variant='body2' color='textSecondary'>
            Awaiting admin verification — you'll be notified via Slack when reviewed.
          </Typography>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id='member-my-claims-table'
          title='Active Claims'
          loading={isRequesting}
          data={claimList}
          error={error}
          columns={columns}
          rowId={(t: VolunteerTask) => t.id}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
        />
      </Grid>
    </Grid>
  );
};

const MyClaims = withQueryContext(MyClaimsInner);

// ── Tasks Table ───────────────────────────────────────────────────────────────
// Shows claimable parent tasks. Members interact with these to initiate claims.
// Their in-progress claims appear in MyClaims above.

interface TasksTableProps {
  member: Member;
  onRefresh: () => void;
}

const TasksTableInner: React.FC<TasksTableProps> = ({ member, onRefresh }) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const { isRequesting, data: tasks = [], response, error, refresh } =
    useReadTransaction(getMemberVolunteerTasks, {}, undefined, 'member-volunteer-tasks');

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setSelectedIds([]);
    refreshRef.current();
    onRefresh();
  }, [onRefresh]);

  const { call: claimTask, isRequesting: claiming, error: claimError } =
    useWriteTransaction(claimVolunteerTask, onSuccess);

  const taskList = tasks as VolunteerTask[];

  const selectedTask = selectedIds.length === 1
    ? taskList.find(t => t.id === selectedIds[0])
    : null;

  // Standard tasks only block claiming if the member already holds one.
  // Multi-use tasks (reusable/repeatable/recurring) don't block standard claims
  // and the server enforces their own rules (reusable-once, cooldown).
  const myStandardActiveTask = taskList.find(
    t => t.claimedById === member.id && ['claimed', 'pending'].includes(t.status) && !t.isChildTask
  );

  const canClaimSelected = (() => {
    if (!selectedTask) return false;
    const { status } = selectedTask;
    if (status === 'available') return !myStandardActiveTask;
    if (['reusable', 'repeatable', 'recurring'].includes(status)) return true;
    return false;
  })();

  const columns: Column<VolunteerTask>[] = [
    {
      id: 'title',
      label: 'Task',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerTask) => (
        <div>
          <Typography variant='body2'>
            <strong>#{row.taskNumber} — {row.title}</strong>
          </Typography>
          <Typography variant='caption' color='textSecondary'>{row.description}</Typography>
          {row.shopName && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>{row.shopName}</Typography>
          )}
          {row.status === 'recurring' && row.days != null && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              <RepeatIcon style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }} />
              Resets every {row.days} day{row.days !== 1 ? 's' : ''}
            </Typography>
          )}
          {row.status === 'reusable' && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              Each member may claim this once
            </Typography>
          )}
          {row.status === 'repeatable' && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              Can be claimed multiple times
            </Typography>
          )}
        </div>
      ),
    },
    {
      id: 'creditValue',
      label: 'Credits',
      cell: (row: VolunteerTask) => <Typography variant='body2'>{row.creditValue}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row: VolunteerTask) => {
        const s = taskStatusLabel(row.status);
        return <StatusLabel label={s.label} color={s.color} />;
      },
    },
  ];

  return (
    <Grid container spacing={2}>
      {selectedTask?.status === 'available' && (
        <Grid size={{ xs: 12 }}>
          {canClaimSelected ? (
            <>
              <Button variant='contained' color='primary' size='small'
                disabled={claiming} startIcon={<AssignmentIcon />}
                onClick={() => claimTask({ id: selectedTask.id })}>
                Claim Task
              </Button>
              {claimError && <ErrorMessage error={claimError} />}
            </>
          ) : (
            <Alert severity='info' style={{ padding: '4px 12px' }}>
              Complete or release your current task before claiming another standard task.
            </Alert>
          )}
        </Grid>
      )}

      {selectedTask && ['reusable', 'repeatable', 'recurring'].includes(selectedTask.status) && (
        <Grid size={{ xs: 12 }}>
          <Button variant='contained' color='primary' size='small'
            disabled={claiming} startIcon={<AssignmentIcon />}
            onClick={() => claimTask({ id: selectedTask.id })}>
            Claim Task
          </Button>
          {claimError && <ErrorMessage error={claimError} />}
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id='member-volunteer-tasks-table'
          title='Available Bounty Tasks'
          loading={isRequesting}
          data={taskList}
          error={error}
          columns={columns}
          rowId={(t: VolunteerTask) => t.id}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
        />
      </Grid>
    </Grid>
  );
};

const TasksTable = withQueryContext(TasksTableInner);

// ── Events Table ──────────────────────────────────────────────────────────────

interface EventsTableProps {
  member: Member;
  onRefresh: () => void;
}

const EventsTableInner: React.FC<EventsTableProps> = ({ member, onRefresh }) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const { isRequesting, data: events = [], response, error, refresh } =
    useReadTransaction(getMemberVolunteerEvents, {}, undefined, 'member-volunteer-events');

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setSelectedIds([]);
    refreshRef.current();
    onRefresh();
  }, [onRefresh]);

  const { call: checkin,       isRequesting: checkingIn,    error: checkinError } = useWriteTransaction(checkinVolunteerEvent, onSuccess);
  const { call: removeCheckin, isRequesting: removingCheckin, error: removeError } = useWriteTransaction(removeCheckinVolunteerEvent, onSuccess);

  const selectedEvent = selectedIds.length === 1
    ? (events as VolunteerEvent[]).find(e => e.id === selectedIds[0])
    : null;

  const alreadyCheckedIn = selectedEvent?.attendeeIds.includes(member.id) ?? false;
  const eventDatePassed  = selectedEvent?.eventDate
    ? new Date(selectedEvent.eventDate) < new Date(new Date().toDateString())
    : false;

  const columns: Column<VolunteerEvent>[] = [
    {
      id: 'title',
      label: 'Event',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerEvent) => (
        <div>
          <Typography variant='body2'><strong>E{row.eventNumber} — {row.title}</strong></Typography>
          {row.description && <Typography variant='caption' color='textSecondary'>{row.description}</Typography>}
          {row.eventDate && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              {new Date(row.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          )}
        </div>
      ),
    },
    {
      id: 'creditValue',
      label: 'Credits',
      cell: (row: VolunteerEvent) => <Typography variant='body2'>{row.creditValue}</Typography>,
    },
    {
      id: 'checkedIn',
      label: 'Checked In',
      cell: (row: VolunteerEvent) => (
        <Tooltip title={row.attendeeIds.includes(member.id) ? 'You are checked in to this event' : ''} placement='top'>
          <span>
            <StatusLabel
              label={row.attendeeIds.includes(member.id) ? 'Yes' : 'No'}
              color={row.attendeeIds.includes(member.id) ? Status.Success : Status.Default}
            />
          </span>
        </Tooltip>
      ),
    },
  ];

  if ((events as VolunteerEvent[]).length === 0 && !isRequesting) return null;

  return (
    <Grid container spacing={2}>
      {selectedEvent && !alreadyCheckedIn && !eventDatePassed && (
        <Grid size={{ xs: 12 }}>
          <Button variant='contained' color='primary' size='small'
            disabled={checkingIn} startIcon={<EventIcon />}
            onClick={() => checkin({ id: selectedEvent.id })}>
            Check In
          </Button>
          {checkinError && <ErrorMessage error={checkinError} />}
        </Grid>
      )}
      {selectedEvent && !alreadyCheckedIn && eventDatePassed && (
        <Grid size={{ xs: 12 }}>
          <Typography variant='body2' color='textSecondary'>
            Check-in is no longer available — this event's date has passed.
          </Typography>
        </Grid>
      )}
      {selectedEvent && alreadyCheckedIn && !eventDatePassed && (
        <Grid size={{ xs: 12 }}>
          <Grid container spacing={2} alignItems='center'>
            <Grid>
              <Typography variant='body2' color='textSecondary'>✅ You're checked in to this event</Typography>
            </Grid>
            <Grid>
              <Button variant='outlined' color='secondary' size='small'
                disabled={removingCheckin} startIcon={<CancelIcon />}
                onClick={() => removeCheckin({ id: selectedEvent.id })}>
                Remove Check-in
              </Button>
            </Grid>
          </Grid>
          {removeError && <ErrorMessage error={removeError} />}
        </Grid>
      )}
      {selectedEvent && alreadyCheckedIn && eventDatePassed && (
        <Grid size={{ xs: 12 }}>
          <Typography variant='body2' color='textSecondary'>✅ You're checked in to this event</Typography>
        </Grid>
      )}
      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id='member-volunteer-events-table' title='Open Events'
          loading={isRequesting} data={events as VolunteerEvent[]} error={error}
          columns={columns} rowId={(e: VolunteerEvent) => e.id}
          totalItems={extractTotalItems(response)} selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
        />
      </Grid>
    </Grid>
  );
};

const EventsTable = withQueryContext(EventsTableInner);

// ── Summary Banner ────────────────────────────────────────────────────────────

const SummaryBanner: React.FC<{ summary: VolunteerSummary }> = ({ summary }) => (
  <Grid container spacing={2} style={{ marginBottom: 8, paddingLeft: 8 }}>
    <Grid size={{ xs: 12, sm: 3 }}>
      <Typography variant='h6' color='primary'>{summary.lifetime_count}</Typography>
      <Typography variant='body2' color='textSecondary'>Lifetime credits</Typography>
    </Grid>
    <Grid size={{ xs: 12, sm: 3 }}>
      <Typography variant='h6' color='primary'>{summary.rolling_count}</Typography>
      <Typography variant='body2' color='textSecondary'>Last {summary.rolling_days} days</Typography>
    </Grid>
    <Grid size={{ xs: 12, sm: 3 }}>
      <Typography variant='h6' color='primary'>{summary.year_count}</Typography>
      <Typography variant='body2' color='textSecondary'>Credits this year</Typography>
      {summary.message && (
        <Typography variant='body2' color='primary' style={{ marginTop: 4 }}>{summary.message}</Typography>
      )}
    </Grid>
    <Grid size={{ xs: 12, sm: 3 }}>
      <Typography variant='h6'>{summary.discounts_used} / {summary.max_discounts}</Typography>
      <Typography variant='body2' color='textSecondary'>Discounts applied</Typography>
    </Grid>
    {summary.pending_count > 0 && (
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6'>{summary.pending_count}</Typography>
        <Typography variant='body2' color='textSecondary'>Pending approval</Typography>
      </Grid>
    )}
  </Grid>
);

// ── Main Tab ──────────────────────────────────────────────────────────────────

const MemberVolunteerTab: React.FC<Props> = ({ member }) => {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const triggerRefresh = React.useCallback(() => setRefreshKey(k => k + 1), []);

  const { data: summary } = useReadTransaction(getVolunteerSummary, {}, undefined, `volunteer-summary-${refreshKey}`);
  const s = summary as VolunteerSummary | undefined;

  return (
    <Grid container spacing={3}>
      {s && (
        <Grid size={{ xs: 12 }}>
          <SummaryBanner summary={s} />
          <Divider />
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <EventsTable member={member} onRefresh={triggerRefresh} />
      </Grid>

      {/* Active claims section — only renders if the member has claimed/pending tasks */}
      <Grid size={{ xs: 12 }}>
        <MyClaims member={member} onRefresh={triggerRefresh} />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <TasksTable member={member} onRefresh={triggerRefresh} />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <CreditHistory />
      </Grid>
    </Grid>
  );
};

export default MemberVolunteerTab;
