import * as React from 'react';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormLabel from '@material-ui/core/FormLabel';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import PersonAddIcon from '@material-ui/icons/PersonAdd';

import FormModal from 'ui/common/FormModal';
import ErrorMessage from 'ui/common/ErrorMessage';
import StatefulTable from 'ui/common/table/StatefulTable';
import { Column } from 'ui/common/table/Table';
import { SortDirection } from 'ui/common/table/constants';
import { withQueryContext } from 'ui/common/Filters/QueryContext';
import StatusLabel from 'ui/common/StatusLabel';
import { Status } from 'ui/constants';
import MemberSearchInput from 'ui/common/MemberSearchInput';
import { SelectOption } from 'ui/common/AsyncSelect';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';
import extractTotalItems from 'ui/utils/extractTotalItems';
import { useAuthState } from 'ui/reducer/hooks';
import { useCapabilities } from 'app/permissions';

import { VolunteerCredit, VolunteerTask, VolunteerEvent } from 'app/entities/volunteer';
import {
  adminListVolunteerCredits,
  adminApproveVolunteerCredit,
  adminRejectVolunteerCredit,
  adminDeleteVolunteerCredit,
  adminListVolunteerTasks,
  adminCreateVolunteerTask,
  adminUpdateVolunteerTask,
  adminCompleteVolunteerTask,
  adminCancelVolunteerTask,
  adminReleaseVolunteerTask,
  adminRejectPendingVolunteerTask,
  adminDeleteVolunteerTask,
  adminListVolunteerEvents,
  adminCreateVolunteerEvent,
  adminCloseVolunteerEvent,
  adminAddEventAttendee,
  adminDeleteVolunteerEvent,
} from 'api/volunteer';

type TabKey = 'credits' | 'tasks' | 'events';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'credits', label: 'Credits' },
  { key: 'tasks',   label: 'Bounty Tasks' },
  { key: 'events',  label: 'Events' },
];

// ── Status helpers ────────────────────────────────────────────────────────────

const creditStatusLabel = (status: string): { label: string; color: Status } => {
  switch (status) {
    case 'approved':  return { label: 'Approved',  color: Status.Success };
    case 'pending':   return { label: 'Pending',   color: Status.Warn };
    case 'rejected':  return { label: 'Rejected',  color: Status.Danger };
    default:          return { label: status,      color: Status.Default };
  }
};

const taskStatusLabel = (status: string): { label: string; color: Status } => {
  switch (status) {
    case 'available':  return { label: 'Available',            color: Status.Success };
    case 'claimed':    return { label: 'Claimed',              color: Status.Info };
    case 'pending':    return { label: 'Pending Verification', color: Status.Warn };
    case 'completed':  return { label: 'Completed',            color: Status.Primary };
    case 'cancelled':  return { label: 'Cancelled',            color: Status.Danger };
    default:           return { label: status,                 color: Status.Default };
  }
};

const eventStatusLabel = (status: string): { label: string; color: Status } => {
  switch (status) {
    case 'open':   return { label: 'Open',   color: Status.Success };
    case 'closed': return { label: 'Closed', color: Status.Default };
    default:       return { label: status,   color: Status.Default };
  }
};

// ── Shared Modals ─────────────────────────────────────────────────────────────

interface ReasonModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
  error: string;
}

const ReasonModal: React.FC<ReasonModalProps> = ({ title, isOpen, onClose, onSubmit, loading, error }) => {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => { if (!isOpen) setReason(''); }, [isOpen]);
  return (
    <FormModal id='volunteer-reason' title={title} isOpen={isOpen} closeHandler={onClose}
      onSubmit={() => reason.trim() && onSubmit(reason)} loading={loading} error={error}>
      <TextField label='Reason' value={reason} onChange={e => setReason(e.target.value)}
        fullWidth required multiline rows={2} autoFocus />
    </FormModal>
  );
};

// ── Credits Tab ───────────────────────────────────────────────────────────────

const CreditsTabInner: React.FC = () => {
  const { canDeleteVolunteerRecords: isAdmin } = useCapabilities();

  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedIds, setSelectedIds]   = React.useState<string[]>([]);

  const { isRequesting, data: credits = [], response, refresh, error: loadError } =
    useReadTransaction(adminListVolunteerCredits, { status: statusFilter || undefined }, undefined, `volunteer-credits-${statusFilter}`);

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const onSuccess = React.useCallback(() => { setSelectedIds([]); refreshRef.current(); }, []);

  const { call: approveCredit, isRequesting: approving, error: approveError } = useWriteTransaction(adminApproveVolunteerCredit, onSuccess);
  const { call: rejectCredit,  isRequesting: rejecting, error: rejectError }  = useWriteTransaction(adminRejectVolunteerCredit, onSuccess);
  const { call: deleteCredit,  isRequesting: deleting,  error: deleteError }  = useWriteTransaction(adminDeleteVolunteerCredit, onSuccess);

  const selectedCredit = selectedIds.length === 1
    ? (credits as VolunteerCredit[]).find(c => c.id === selectedIds[0])
    : null;

  const columns: Column<VolunteerCredit>[] = [
    {
      id: 'member',
      label: 'Member',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerCredit) => (
        <div>
          <Typography variant='body2'><strong>{row.memberName}</strong></Typography>
          <Typography variant='caption' color='textSecondary'>
            {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {row.issuedByName && ` — ${row.issuedByName}`}
          </Typography>
        </div>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      cell: (row: VolunteerCredit) => (
        <div>
          <Typography variant='body2'>{row.description}</Typography>
          {row.taskTitle && <Typography variant='caption' color='textSecondary'>Task: {row.taskTitle}</Typography>}
        </div>
      ),
    },
    {
      id: 'creditValue',
      label: 'Credits',
      cell: (row: VolunteerCredit) => <Typography variant='body2'>{row.creditValue}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row: VolunteerCredit) => {
        const s = creditStatusLabel(row.status);
        return (
          <div>
            <StatusLabel label={s.label} color={s.color} />
            {row.discountApplied && <div><StatusLabel label='Discount Applied' color={Status.Primary} /></div>}
          </div>
        );
      },
    },
  ];

  return (
    <Grid container spacing={2}>
      {/* Filter + Actions row */}
      <Grid item xs={12}>
        <Grid container spacing={2} alignItems='center'>
          <Grid item xs={12} sm={3}>
            <FormLabel>Filter by Status</FormLabel>
            <Select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as string); setSelectedIds([]); }}
              fullWidth
              displayEmpty
            >
              <MenuItem value=''>All</MenuItem>
              <MenuItem value='pending'>Pending</MenuItem>
              <MenuItem value='approved'>Approved</MenuItem>
              <MenuItem value='rejected'>Rejected</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={12} sm={9}>
            <Grid container spacing={1} justify='flex-end' alignItems='flex-end' style={{ height: '100%' }}>
              {selectedCredit?.status === 'pending' && (
                <>
                  <Grid item>
                    <Button variant='contained' color='primary' size='small'
                      disabled={approving} startIcon={<CheckIcon />}
                      onClick={() => approveCredit({ id: selectedCredit.id })}>
                      Approve
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button variant='outlined' color='secondary' size='small'
                      disabled={rejecting} startIcon={<CloseIcon />}
                      onClick={() => rejectCredit({ id: selectedCredit.id })}>
                      Reject
                    </Button>
                  </Grid>
                </>
              )}
              {isAdmin && selectedIds.length > 0 && (
                <Grid item>
                  <Button variant='outlined' color='secondary' size='small'
                    disabled={deleting} startIcon={<DeleteIcon />}
                    onClick={() => selectedIds.forEach(id => deleteCredit({ id }))}>
                    Delete ({selectedIds.length})
                  </Button>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {(approveError || rejectError || deleteError) && (
        <Grid item xs={12}>
          <ErrorMessage error={approveError || rejectError || deleteError} />
        </Grid>
      )}

      <Grid item xs={12}>
        <StatefulTable
          id='volunteer-credits-table'
          title='Volunteer Credits'
          loading={isRequesting}
          data={credits as VolunteerCredit[]}
          error={loadError}
          columns={columns}
          rowId={(c: VolunteerCredit) => c.id}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
          renderSearch={true}
        />
      </Grid>
    </Grid>
  );
};

const CreditsTab = withQueryContext(CreditsTabInner);

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

interface EditTaskModalProps {
  task: VolunteerTask | null;
  onClose: () => void;
  onSave: (id: string, body: Partial<VolunteerTask>) => void;
  loading: boolean;
  error: string;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, onClose, onSave, loading, error }) => {
  const [title, setTitle]             = React.useState('');
  const [description, setDescription] = React.useState('');

  React.useEffect(() => {
    if (task) { setTitle(task.title); setDescription(task.description); }
    else { setTitle(''); setDescription(''); }
  }, [task]);

  return (
    <FormModal id='edit-volunteer-task' title='Edit Task' isOpen={!!task} closeHandler={onClose}
      onSubmit={() => task && title && onSave(task.id, { title, description })}
      loading={loading} error={error}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label='Title' value={title} onChange={e => setTitle(e.target.value)} fullWidth required autoFocus />
        </Grid>
        <Grid item xs={12}>
          <TextField label='Description' value={description} onChange={e => setDescription(e.target.value)}
            fullWidth multiline rows={3} />
        </Grid>
      </Grid>
    </FormModal>
  );
};

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: { title: string; description: string; creditValue: number }) => void;
  loading: boolean;
  error: string;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSave, loading, error }) => {
  const [title, setTitle]             = React.useState('');
  const [description, setDescription] = React.useState('');
  const [creditValue, setCreditValue] = React.useState('1');
  React.useEffect(() => { if (!isOpen) { setTitle(''); setDescription(''); setCreditValue('1'); } }, [isOpen]);
  return (
    <FormModal id='create-volunteer-task' title='Create Bounty Task' isOpen={isOpen} closeHandler={onClose}
      onSubmit={() => title && description && onSave({ title, description, creditValue: parseFloat(creditValue) || 1 })}
      loading={loading} error={error}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label='Title' value={title} onChange={e => setTitle(e.target.value)} fullWidth required autoFocus />
        </Grid>
        <Grid item xs={12}>
          <TextField label='Description' value={description} onChange={e => setDescription(e.target.value)}
            fullWidth multiline rows={3} required />
        </Grid>
        <Grid item xs={12}>
          <TextField label='Credit Value' value={creditValue} onChange={e => setCreditValue(e.target.value)}
            type='number' inputProps={{ min: 0.5, max: 2, step: 0.5 }} fullWidth required helperText='Max 2 credits' />
        </Grid>
      </Grid>
    </FormModal>
  );
};

const TasksTabInner: React.FC = () => {
  const { canDeleteVolunteerRecords: isAdmin } = useCapabilities();

  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedIds, setSelectedIds]   = React.useState<string[]>([]);
  const [createOpen, setCreateOpen]     = React.useState(false);
  const [editTarget, setEditTarget]     = React.useState<VolunteerTask | null>(null);
  const [releaseTarget, setRelease]     = React.useState<string | null>(null);
  const [rejectTarget, setReject]       = React.useState<string | null>(null);

  const { isRequesting, data: tasks = [], response, refresh, error: loadError } =
    useReadTransaction(adminListVolunteerTasks, { status: statusFilter || undefined }, undefined, `volunteer-tasks-${statusFilter}`);

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setCreateOpen(false); setEditTarget(null);
    setRelease(null); setReject(null);
    setSelectedIds([]);
    refreshRef.current();
  }, []);

  const { call: createTask, isRequesting: creating, error: createError } = useWriteTransaction(adminCreateVolunteerTask, onSuccess);
  const { call: updateTask, isRequesting: updating, error: updateError } = useWriteTransaction(adminUpdateVolunteerTask, onSuccess);
  const { call: completeTask, isRequesting: completing, error: completeError } = useWriteTransaction(adminCompleteVolunteerTask, onSuccess);
  const { call: cancelTask }  = useWriteTransaction(adminCancelVolunteerTask, onSuccess);
  const { call: deleteTask }  = useWriteTransaction(adminDeleteVolunteerTask, onSuccess);
  const { call: releaseTask, isRequesting: releasing, error: releaseError } = useWriteTransaction(adminReleaseVolunteerTask, onSuccess);
  const { call: rejectTask,  isRequesting: rejecting, error: rejectError }  = useWriteTransaction(adminRejectPendingVolunteerTask, onSuccess);

  const selectedTask = selectedIds.length === 1
    ? (tasks as VolunteerTask[]).find(t => t.id === selectedIds[0])
    : null;

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
          {row.claimedByName && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              Claimed by: {row.claimedByName}
            </Typography>
          )}
          {row.rejectionReason && (
            <Typography variant='caption' color='error' style={{ display: 'block' }}>
              Reason: {row.rejectionReason}
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
      {/* Filter + Actions row */}
      <Grid item xs={12}>
        <Grid container spacing={2} alignItems='center'>
          <Grid item xs={12} sm={3}>
            <FormLabel>Filter by Status</FormLabel>
            <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as string); setSelectedIds([]); }}
              fullWidth displayEmpty>
              <MenuItem value=''>All</MenuItem>
              <MenuItem value='available'>Available</MenuItem>
              <MenuItem value='claimed'>Claimed</MenuItem>
              <MenuItem value='pending'>Pending Verification</MenuItem>
              <MenuItem value='completed'>Completed</MenuItem>
              <MenuItem value='cancelled'>Cancelled</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={12} sm={9}>
            <Grid container spacing={1} justify='flex-end' alignItems='flex-end'>
              <Grid item>
                <Button variant='contained' color='primary' size='small' startIcon={<AddIcon />}
                  onClick={() => setCreateOpen(true)}>
                  Create Task
                </Button>
              </Grid>
              {selectedTask && ['available', 'claimed'].includes(selectedTask.status) && (
                <Grid item>
                  <Button variant='outlined' size='small' startIcon={<EditIcon />}
                    onClick={() => setEditTarget(selectedTask)}>
                    Edit
                  </Button>
                </Grid>
              )}
              {selectedTask?.status === 'pending' && (
                <>
                  <Grid item>
                    <Button variant='contained' color='primary' size='small' startIcon={<CheckIcon />}
                      disabled={completing}
                      onClick={() => completeTask({ id: selectedTask.id })}>
                      Verify
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button variant='outlined' color='secondary' size='small' startIcon={<CloseIcon />}
                      onClick={() => setReject(selectedTask.id)}>
                      Reject
                    </Button>
                  </Grid>
                </>
              )}
              {selectedTask?.status === 'claimed' && (
                <Grid item>
                  <Button variant='outlined' color='secondary' size='small'
                    onClick={() => setRelease(selectedTask.id)}>
                    Release
                  </Button>
                </Grid>
              )}
              {selectedTask?.status === 'available' && (
                <Grid item>
                  <Button variant='outlined' color='secondary' size='small' startIcon={<CloseIcon />}
                    onClick={() => cancelTask({ id: selectedTask.id })}>
                    Cancel
                  </Button>
                </Grid>
              )}
              {isAdmin && selectedIds.length > 0 &&
                (tasks as VolunteerTask[]).filter(t => selectedIds.includes(t.id))
                  .every(t => ['completed', 'cancelled'].includes(t.status)) && (
                <Grid item>
                  <Button variant='outlined' color='secondary' size='small' startIcon={<DeleteIcon />}
                    onClick={() => selectedIds.forEach(id => deleteTask({ id }))}>
                    Delete ({selectedIds.length})
                  </Button>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {(completeError || releaseError || rejectError) && (
        <Grid item xs={12}>
          <ErrorMessage error={completeError || releaseError || rejectError} />
        </Grid>
      )}

      <Grid item xs={12}>
        <StatefulTable
          id='volunteer-tasks-table'
          title='Bounty Tasks'
          loading={isRequesting}
          data={tasks as VolunteerTask[]}
          error={loadError}
          columns={columns}
          rowId={(t: VolunteerTask) => t.id}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
          renderSearch={true}
        />
      </Grid>

      <CreateTaskModal isOpen={createOpen} onClose={() => setCreateOpen(false)}
        onSave={task => createTask({ body: { title: task.title, description: task.description, creditValue: task.creditValue } })}
        loading={creating} error={createError} />

      <EditTaskModal task={editTarget} onClose={() => setEditTarget(null)}
        onSave={(id, body) => updateTask({ id, body })}
        loading={updating} error={updateError} />

      <ReasonModal title='Release Task' isOpen={!!releaseTarget} onClose={() => setRelease(null)}
        onSubmit={reason => releaseTask({ id: releaseTarget, reason })}
        loading={releasing} error={releaseError} />

      <ReasonModal title='Reject Task Completion' isOpen={!!rejectTarget} onClose={() => setReject(null)}
        onSubmit={reason => rejectTask({ id: rejectTarget, reason })}
        loading={rejecting} error={rejectError} />
    </Grid>
  );
};

const TasksTab = withQueryContext(TasksTabInner);

// ── Events Tab ────────────────────────────────────────────────────────────────

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: { title: string; description: string; creditValue: number; eventDate: string }) => void;
  loading: boolean;
  error: string;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onSave, loading, error }) => {
  const [title, setTitle]             = React.useState('');
  const [description, setDescription] = React.useState('');
  const [creditValue, setCreditValue] = React.useState('1');
  const [eventDate, setEventDate]     = React.useState('');
  React.useEffect(() => {
    if (!isOpen) { setTitle(''); setDescription(''); setCreditValue('1'); setEventDate(''); }
  }, [isOpen]);
  return (
    <FormModal id='create-volunteer-event' title='Create Volunteer Event' isOpen={isOpen} closeHandler={onClose}
      onSubmit={() => title && onSave({ title, description, creditValue: parseFloat(creditValue) || 1, eventDate })}
      loading={loading} error={error}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label='Title' value={title} onChange={e => setTitle(e.target.value)} fullWidth required autoFocus />
        </Grid>
        <Grid item xs={12}>
          <TextField label='Description' value={description} onChange={e => setDescription(e.target.value)}
            fullWidth multiline rows={2} />
        </Grid>
        <Grid item xs={6}>
          <TextField label='Credit Value' value={creditValue} onChange={e => setCreditValue(e.target.value)}
            type='number' inputProps={{ min: 0.5, step: 0.5 }} fullWidth required />
        </Grid>
        <Grid item xs={6}>
          <TextField label='Event Date' value={eventDate} onChange={e => setEventDate(e.target.value)}
            type='date' fullWidth InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>
    </FormModal>
  );
};

interface AddAttendeeModalProps {
  eventId: string | null;
  onClose: () => void;
  onAdd: (memberId: string) => void;
  loading: boolean;
  error: string;
}

const AddAttendeeModal: React.FC<AddAttendeeModalProps> = ({ eventId, onClose, onAdd, loading, error }) => {
  const [selectedMember, setSelectedMember] = React.useState<SelectOption | null>(null);
  React.useEffect(() => { if (!eventId) setSelectedMember(null); }, [eventId]);
  return (
    <FormModal id='add-event-attendee' title='Add Attendee' isOpen={!!eventId} closeHandler={onClose}
      onSubmit={() => selectedMember?.id && onAdd(selectedMember.id)}
      loading={loading} error={error}>
      <MemberSearchInput
        name='event-attendee-search'
        placeholder='Search by name or email'
        initialSelection={selectedMember}
        onChange={setSelectedMember}
      />
    </FormModal>
  );
};

const EventsTabInner: React.FC = () => {
  const { canDeleteVolunteerRecords: isAdmin } = useCapabilities();

  const [statusFilter, setStatusFilter]     = React.useState('open');
  const [selectedIds, setSelectedIds]       = React.useState<string[]>([]);
  const [createOpen, setCreateOpen]         = React.useState(false);
  const [addAttendeeTarget, setAddAttendee] = React.useState<string | null>(null);

  const { isRequesting, data: events = [], response, refresh, error: loadError } =
    useReadTransaction(adminListVolunteerEvents, { status: statusFilter || undefined }, undefined, `volunteer-events-${statusFilter}`);

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setCreateOpen(false); setAddAttendee(null); setSelectedIds([]);
    refreshRef.current();
  }, []);

  const { call: createEvent, isRequesting: creating, error: createError } = useWriteTransaction(adminCreateVolunteerEvent, onSuccess);
  const { call: closeEvent,  isRequesting: closing,  error: closeError }  = useWriteTransaction(adminCloseVolunteerEvent, onSuccess);
  const { call: addAttendee, isRequesting: addingAttendee, error: addAttendeeError } = useWriteTransaction(adminAddEventAttendee, onSuccess);
  const { call: deleteEvent } = useWriteTransaction(adminDeleteVolunteerEvent, onSuccess);

  const selectedEvent = selectedIds.length === 1
    ? (events as VolunteerEvent[]).find(e => e.id === selectedIds[0])
    : null;

  const columns: Column<VolunteerEvent>[] = [
    {
      id: 'title',
      label: 'Event',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerEvent) => (
        <div>
          <Typography variant='body2'>
            <strong>E{row.eventNumber} — {row.title}</strong>
          </Typography>
          {row.description && (
            <Typography variant='caption' color='textSecondary'>{row.description}</Typography>
          )}
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
      id: 'attendees',
      label: 'Attendees',
      cell: (row: VolunteerEvent) => <Typography variant='body2'>{row.attendeeCount}</Typography>,
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row: VolunteerEvent) => {
        const s = eventStatusLabel(row.status);
        return <StatusLabel label={s.label} color={s.color} />;
      },
    },
  ];

  return (
    <Grid container spacing={2}>
      {/* Filter + Actions */}
      <Grid item xs={12}>
        <Grid container spacing={2} alignItems='center'>
          <Grid item xs={12} sm={3}>
            <FormLabel>Filter by Status</FormLabel>
            <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as string); setSelectedIds([]); }}
              fullWidth displayEmpty>
              <MenuItem value=''>All</MenuItem>
              <MenuItem value='open'>Open</MenuItem>
              <MenuItem value='closed'>Closed</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={12} sm={9}>
            <Grid container spacing={1} justify='flex-end' alignItems='flex-end'>
              <Grid item>
                <Button variant='contained' color='primary' size='small' startIcon={<AddIcon />}
                  onClick={() => setCreateOpen(true)}>
                  Create Event
                </Button>
              </Grid>
              {selectedEvent?.status === 'open' && (
                <>
                  <Grid item>
                    <Button variant='outlined' size='small' startIcon={<PersonAddIcon />}
                      onClick={() => setAddAttendee(selectedEvent.id)}>
                      Add Attendee
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button variant='contained' color='primary' size='small' startIcon={<CheckIcon />}
                      disabled={closing}
                      onClick={() => closeEvent({ id: selectedEvent.id })}>
                      Close Event
                    </Button>
                  </Grid>
                </>
              )}
              {isAdmin && selectedIds.length > 0 &&
                (events as VolunteerEvent[]).filter(e => selectedIds.includes(e.id))
                  .every(e => e.status === 'closed') && (
                <Grid item>
                  <Button variant='outlined' color='secondary' size='small' startIcon={<DeleteIcon />}
                    onClick={() => selectedIds.forEach(id => deleteEvent({ id }))}>
                    Delete ({selectedIds.length})
                  </Button>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {(closeError || addAttendeeError) && (
        <Grid item xs={12}>
          <ErrorMessage error={closeError || addAttendeeError} />
        </Grid>
      )}

      <Grid item xs={12}>
        <StatefulTable
          id='volunteer-events-table'
          title='Volunteer Events'
          loading={isRequesting}
          data={events as VolunteerEvent[]}
          error={loadError}
          columns={columns}
          rowId={(e: VolunteerEvent) => e.id}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
          renderSearch={true}
        />
      </Grid>

      <CreateEventModal isOpen={createOpen} onClose={() => setCreateOpen(false)}
        onSave={event => createEvent({ body: { title: event.title, description: event.description, creditValue: event.creditValue, eventDate: event.eventDate } })}
        loading={creating} error={createError} />

      <AddAttendeeModal eventId={addAttendeeTarget} onClose={() => setAddAttendee(null)}
        onAdd={memberId => addAttendee({ id: addAttendeeTarget, memberId })}
        loading={addingAttendee} error={addAttendeeError} />
    </Grid>
  );
};

const EventsTab = withQueryContext(EventsTabInner);

// ── Main Page ─────────────────────────────────────────────────────────────────

const AdminVolunteerPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('credits');

  return (
    <Grid container spacing={3} justify='center'>
      <Grid item md={10} xs={12}>
        <Typography variant='h5' gutterBottom>Volunteer</Typography>
        <Typography variant='body2' color='textSecondary'>
          Manage volunteer credits, bounty tasks, and events.
        </Typography>
      </Grid>

      <Grid item md={10} xs={12}>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val as TabKey)}
          indicatorColor='primary' textColor='primary' variant='scrollable' scrollButtons='auto'>
          {TABS.map(t => (
            <Tab key={t.key} id={`volunteer-tab-${t.key}`} value={t.key} label={t.label} />
          ))}
        </Tabs>
      </Grid>

      <Grid item md={10} xs={12}>
        {activeTab === 'credits' && <CreditsTab />}
        {activeTab === 'tasks'   && <TasksTab />}
        {activeTab === 'events'  && <EventsTab />}
      </Grid>
    </Grid>
  );
};

export default AdminVolunteerPage;
