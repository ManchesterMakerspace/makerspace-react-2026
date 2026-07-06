// @ts-nocheck
import * as React from 'react';
import Grid from "@mui/material/Grid";
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PeopleIcon from '@mui/icons-material/People';
import UndoIcon from '@mui/icons-material/Undo';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import RepeatIcon from '@mui/icons-material/Repeat';
import RestoreIcon from '@mui/icons-material/Restore';
import ListAltIcon from '@mui/icons-material/ListAlt';

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
import { useCapabilities } from 'app/permissions';

import { VolunteerCredit, VolunteerTask, VolunteerTaskStatus, VolunteerEvent } from 'app/entities/volunteer';
import {
  adminListVolunteerCredits,
  adminAwardVolunteerCredit,
  adminApproveVolunteerCredit,
  adminRejectVolunteerCredit,
  adminReverseVolunteerCredit,
  adminDeleteVolunteerCredit,
  adminListVolunteerTasks,
  adminCreateVolunteerTask,
  adminUpdateVolunteerTask,
  adminCompleteVolunteerTask,
  adminCancelVolunteerTask,
  adminReleaseVolunteerTask,
  adminRejectPendingVolunteerTask,
  adminResetTaskCooldown,
  adminDeleteVolunteerTask,
  adminListVolunteerEvents,
  adminCreateVolunteerEvent,
  adminCloseVolunteerEvent,
  adminAddEventAttendee,
  adminRemoveEventAttendee,
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
    case 'reversal':  return { label: 'Reversed',  color: Status.Danger };
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
    case 'denied':     return { label: 'Denied',               color: Status.Danger };
    case 'reusable':   return { label: 'Reusable',             color: Status.Success };
    case 'repeatable': return { label: 'Repeatable',           color: Status.Success };
    case 'recurring':  return { label: 'Recurring',            color: Status.Success };
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

const MULTI_USE_STATUSES: VolunteerTaskStatus[] = ['reusable', 'repeatable', 'recurring'];
const CANCELLABLE_STATUSES: VolunteerTaskStatus[] = ['available', 'reusable', 'repeatable', 'recurring'];
const EDITABLE_STATUSES: VolunteerTaskStatus[]    = ['available', 'claimed', 'reusable', 'repeatable', 'recurring'];

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

// ── Award Credit Modal ──────────────────────────────────────────────────────
//
// Admin/RM directly award a credit to a member. Always submitted as 'pending' —
// requires a separate approval (Approve button, above) before it counts toward
// the member's totals or triggers notifications/discount checks.

interface AwardCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (memberId: string, description: string, creditValue: number) => void;
  loading: boolean;
  error: string;
}

const AwardCreditModal: React.FC<AwardCreditModalProps> = ({ isOpen, onClose, onSubmit, loading, error }) => {
  const [selectedMember, setSelectedMember] = React.useState<SelectOption | null>(null);
  const [creditValue, setCreditValue]       = React.useState('');
  const [description, setDescription]       = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedMember(null);
      setCreditValue('');
      setDescription('');
    }
  }, [isOpen]);

  const numericValue = parseFloat(creditValue);
  const validValue   = !isNaN(numericValue) && numericValue > 0;
  const canSubmit    = !!selectedMember?.id && description.trim().length > 0 && validValue;

  return (
    <FormModal id='award-volunteer-credit' title='Award Credit' isOpen={isOpen} closeHandler={onClose}
      onSubmit={() => canSubmit && onSubmit(selectedMember.id, description.trim(), numericValue)}
      submitText='Award' loading={loading} error={error}>
      <div style={{ marginBottom: 16 }}>
        <MemberSearchInput name='award-credit-member-search' placeholder='Search by name or email'
          initialSelection={selectedMember} onChange={setSelectedMember} />
      </div>
      <TextField label='Credit Value' type='number' value={creditValue}
        onChange={e => setCreditValue(e.target.value)}
        inputProps={{ min: 0, step: 'any' }}
        helperText='Must be a positive number'
        error={creditValue !== '' && !validValue}
        fullWidth required margin='normal' />
      <TextField label='Description' value={description} onChange={e => setDescription(e.target.value)}
        fullWidth required multiline rows={2} margin='normal' />
    </FormModal>
  );
};

// ── Credits Tab ───────────────────────────────────────────────────────────────

const CreditsTabInner: React.FC = () => {
  const { canDeleteVolunteerRecords: isAdmin } = useCapabilities();

  const [statusFilter, setStatusFilter]   = React.useState('');
  const [selectedIds, setSelectedIds]     = React.useState<string[]>([]);
  const [reverseTarget, setReverseTarget] = React.useState<string | null>(null);
  const [awardModalOpen, setAwardModalOpen] = React.useState(false);

  const { isRequesting, data: credits = [], response, refresh, error: loadError } =
    useReadTransaction(adminListVolunteerCredits, { status: statusFilter || undefined }, undefined, `volunteer-credits-${statusFilter}`);

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setSelectedIds([]);
    setReverseTarget(null);
    refreshRef.current();
  }, []);

  const { call: approveCredit, isRequesting: approving, error: approveError } = useWriteTransaction(adminApproveVolunteerCredit, onSuccess);
  const { call: rejectCredit,  isRequesting: rejecting, error: rejectError }  = useWriteTransaction(adminRejectVolunteerCredit, onSuccess);
  const { call: reverseCredit, isRequesting: reversing, error: reverseError } = useWriteTransaction(adminReverseVolunteerCredit, onSuccess);
  const { call: deleteCredit,  isRequesting: deleting,  error: deleteError }  = useWriteTransaction(adminDeleteVolunteerCredit, onSuccess);

  const onAwardSuccess = React.useCallback(() => {
    setAwardModalOpen(false);
    refreshRef.current();
  }, []);
  const { call: awardCredit, isRequesting: awarding, error: awardError } = useWriteTransaction(adminAwardVolunteerCredit, onAwardSuccess);

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
          <Typography variant='body2' style={{ color: row.status === 'reversal' ? '#c62828' : undefined }}>
            <strong>{row.memberName}</strong>
          </Typography>
          <Typography variant='caption' color='textSecondary'>
            {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {row.issuedByName && ` — ${row.issuedByName}`}
          </Typography>
          {row.status === 'reversal' && row.reversedByName && (
            <Typography variant='caption' color='error' style={{ display: 'block' }}>
              Reversed by: {row.reversedByName}
            </Typography>
          )}
        </div>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      cell: (row: VolunteerCredit) => (
        <div>
          <Typography variant='body2'>{row.description}</Typography>
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
              Reversed — see reversal record
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
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormLabel>Filter by Status</FormLabel>
            <Select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as string); setSelectedIds([]); }}
              fullWidth displayEmpty>
              <MenuItem value=''>All</MenuItem>
              <MenuItem value='pending'>Pending</MenuItem>
              <MenuItem value='approved'>Approved</MenuItem>
              <MenuItem value='rejected'>Rejected</MenuItem>
              <MenuItem value='reversal'>Reversals</MenuItem>
            </Select>
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <Grid container spacing={1} justifyContent='flex-end' alignItems='flex-end' style={{ height: '100%' }}>
              <Grid>
                <Button variant='contained' color='primary' size='small' startIcon={<AddIcon />}
                  onClick={() => setAwardModalOpen(true)}>
                  Award Credit
                </Button>
              </Grid>
              {selectedCredit?.status === 'pending' && (
                <>
                  <Grid>
                    <Button variant='contained' color='primary' size='small'
                      disabled={approving} startIcon={<CheckIcon />}
                      onClick={() => approveCredit({ id: selectedCredit.id })}>
                      Approve
                    </Button>
                  </Grid>
                  <Grid>
                    <Button variant='outlined' color='secondary' size='small'
                      disabled={rejecting} startIcon={<CloseIcon />}
                      onClick={() => rejectCredit({ id: selectedCredit.id })}>
                      Reject
                    </Button>
                  </Grid>
                </>
              )}
              {isAdmin && selectedCredit?.status === 'approved' && !selectedCredit.reversed && (
                <Grid>
                  <Button variant='outlined' color='secondary' size='small'
                    startIcon={<UndoIcon />}
                    onClick={() => setReverseTarget(selectedCredit.id)}>
                    Reverse Credit
                  </Button>
                </Grid>
              )}
              {isAdmin && selectedIds.length > 0 && (
                <Grid>
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
        <Grid size={{ xs: 12 }}>
          <ErrorMessage error={approveError || rejectError || deleteError} />
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
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

      <ReasonModal
        title='Reverse Credit'
        isOpen={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onSubmit={reason => reverseCredit({ id: reverseTarget, reason })}
        loading={reversing}
        error={reverseError}
      />

      <AwardCreditModal
        isOpen={awardModalOpen}
        onClose={() => setAwardModalOpen(false)}
        onSubmit={(memberId, description, creditValue) =>
          awardCredit({ body: { memberId, description, creditValue } })}
        loading={awarding}
        error={awardError}
      />
    </Grid>
  );
};

const CreditsTab = withQueryContext(CreditsTabInner);

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

type TaskType = 'available' | 'reusable' | 'repeatable' | 'recurring';

interface TaskFormState {
  title: string;
  description: string;
  creditValue: string;
  taskType: TaskType;
  days: string;
}

const emptyTaskForm = (): TaskFormState => ({
  title: '', description: '', creditValue: '1', taskType: 'available', days: '7',
});

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (state: TaskFormState) => void;
  loading: boolean;
  error: string;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSave, loading, error }) => {
  const [form, setForm] = React.useState<TaskFormState>(emptyTaskForm());
  React.useEffect(() => { if (!isOpen) setForm(emptyTaskForm()); }, [isOpen]);

  const set = (key: keyof TaskFormState) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value as string }));

  const valid = form.title.trim() && form.description.trim() &&
    (form.taskType !== 'recurring' || parseInt(form.days, 10) > 0);

  return (
    <FormModal id='create-volunteer-task' title='Create Bounty Task' isOpen={isOpen} closeHandler={onClose}
      onSubmit={() => valid && onSave(form)} loading={loading} error={error}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField label='Title' value={form.title} onChange={set('title')} fullWidth required autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField label='Description' value={form.description} onChange={set('description')}
            fullWidth multiline rows={3} required />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label='Credit Value' value={form.creditValue} onChange={set('creditValue')}
            type='number' slotProps={{ htmlInput: { min: 0.5, max: 2, step: 0.5 } }} fullWidth required helperText='Max 2 credits' />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth>
            <InputLabel id='task-type-label'>Task Type</InputLabel>
            <Select labelId='task-type-label' value={form.taskType} label='Task Type'
              onChange={e => setForm(prev => ({ ...prev, taskType: e.target.value as TaskType }))}>
              <MenuItem value='available'>Standard (one-time)</MenuItem>
              <MenuItem value='reusable'>Reusable (any member once)</MenuItem>
              <MenuItem value='repeatable'>Repeatable (any member, unlimited)</MenuItem>
              <MenuItem value='recurring'>Recurring (repeatable with cooldown)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        {form.taskType === 'recurring' && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label='Recurrence Interval (days)' value={form.days} onChange={set('days')}
              type='number' slotProps={{ htmlInput: { min: 1, step: 1 } }} fullWidth required
              helperText='How many days before the task can be claimed again' />
          </Grid>
        )}
        {form.taskType !== 'available' && (
          <Grid size={{ xs: 12 }}>
            <Typography variant='caption' color='textSecondary'>
              {form.taskType === 'reusable'   && 'Each member may claim this task once. The original task stays on the board.'}
              {form.taskType === 'repeatable' && 'Members may claim this task as many times as they want.'}
              {form.taskType === 'recurring'  && `Members may claim this task repeatedly, but it will be hidden for ${form.days || '?'} day(s) after each claim.`}
            </Typography>
          </Grid>
        )}
      </Grid>
    </FormModal>
  );
};

interface EditTaskModalProps {
  task: VolunteerTask | null;
  onClose: () => void;
  onSave: (id: string, body: Partial<VolunteerTask> & { days?: number | null }) => void;
  loading: boolean;
  error: string;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, onClose, onSave, loading, error }) => {
  const [title, setTitle]             = React.useState('');
  const [description, setDescription] = React.useState('');
  const [days, setDays]               = React.useState('');

  React.useEffect(() => {
    if (task) { setTitle(task.title); setDescription(task.description); setDays(task.days != null ? String(task.days) : ''); }
    else { setTitle(''); setDescription(''); setDays(''); }
  }, [task]);

  if (!task) return null;
  const isRecurring = task.status === 'recurring';

  return (
    <FormModal id='edit-volunteer-task' title='Edit Task' isOpen={!!task} closeHandler={onClose}
      onSubmit={() => task && title && onSave(task.id, {
        title, description,
        days: isRecurring && days ? parseInt(days, 10) : undefined,
      })}
      loading={loading} error={error}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField label='Title' value={title} onChange={e => setTitle(e.target.value)} fullWidth required autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField label='Description' value={description} onChange={e => setDescription(e.target.value)}
            fullWidth multiline rows={3} />
        </Grid>
        {isRecurring && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label='Recurrence Interval (days)' value={days} onChange={e => setDays(e.target.value)}
              type='number' slotProps={{ htmlInput: { min: 1, step: 1 } }} fullWidth required
              helperText='Days before the task can be claimed again' />
          </Grid>
        )}
      </Grid>
    </FormModal>
  );
};

// ── Child tasks drill-down view ───────────────────────────────────────────────

interface ChildTasksViewProps {
  parentTask: VolunteerTask;
  onBack: () => void;
  onActionSuccess: () => void;
  isAdmin: boolean;
}

const ChildTasksViewInner: React.FC<ChildTasksViewProps> = ({ parentTask, onBack, onActionSuccess, isAdmin }) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [releaseTarget, setRelease]   = React.useState<string | null>(null);
  const [rejectTarget, setReject]     = React.useState<string | null>(null);

  const { isRequesting, data: children = [], response, refresh, error: loadError } =
    useReadTransaction(
      adminListVolunteerTasks,
      { parentTaskId: parentTask.id },
      undefined,
      `volunteer-tasks-children-${parentTask.id}`
    );

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setSelectedIds([]); setRelease(null); setReject(null);
    refreshRef.current();
    onActionSuccess();
  }, [onActionSuccess]);

  const { call: completeTask, isRequesting: completing, error: completeError } = useWriteTransaction(adminCompleteVolunteerTask, onSuccess);
  const { call: releaseTask,  isRequesting: releasing,  error: releaseError }  = useWriteTransaction(adminReleaseVolunteerTask, onSuccess);
  const { call: rejectTask,   isRequesting: rejecting,  error: rejectError }   = useWriteTransaction(adminRejectPendingVolunteerTask, onSuccess);
  const { call: deleteTask }  = useWriteTransaction(adminDeleteVolunteerTask, onSuccess);

  const selectedChild = selectedIds.length === 1
    ? (children as VolunteerTask[]).find(t => t.id === selectedIds[0])
    : null;

  const columns: Column<VolunteerTask>[] = [
    {
      id: 'claimedBy',
      label: 'Claimed By',
      defaultSortDirection: SortDirection.Asc,
      cell: (row: VolunteerTask) => (
        <div>
          <Typography variant='body2'><strong>{row.claimedByName || '—'}</strong></Typography>
          {row.claimedAt && (
            <Typography variant='caption' color='textSecondary'>
              {new Date(row.claimedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
        <Grid container spacing={1} alignItems='center'>
          <Grid>
            <Button size='small' startIcon={<ArrowBackIcon />} onClick={onBack}>
              Back to Tasks
            </Button>
          </Grid>
          <Grid>
            <Typography variant='subtitle1'>
              Claims for: <strong>#{parentTask.taskNumber} — {parentTask.title}</strong>
            </Typography>
          </Grid>
        </Grid>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Grid container spacing={1} justifyContent='flex-end' alignItems='flex-end'>
          {selectedChild?.status === 'pending' && (
            <>
              <Grid>
                <Button variant='contained' color='primary' size='small' startIcon={<CheckIcon />}
                  disabled={completing}
                  onClick={() => completeTask({ id: selectedChild.id })}>
                  Verify
                </Button>
              </Grid>
              <Grid>
                <Button variant='outlined' color='secondary' size='small' startIcon={<CloseIcon />}
                  onClick={() => setReject(selectedChild.id)}>
                  Reject
                </Button>
              </Grid>
            </>
          )}
          {selectedChild?.status === 'claimed' && (
            <Grid>
              <Button variant='outlined' color='secondary' size='small'
                onClick={() => setRelease(selectedChild.id)}>
                Release
              </Button>
            </Grid>
          )}
          {isAdmin && selectedIds.length > 0 &&
            (children as VolunteerTask[]).filter(t => selectedIds.includes(t.id))
              .every(t => ['completed', 'denied'].includes(t.status)) && (
            <Grid>
              <Button variant='outlined' color='secondary' size='small' startIcon={<DeleteIcon />}
                onClick={() => selectedIds.forEach(id => deleteTask({ id }))}>
                Delete ({selectedIds.length})
              </Button>
            </Grid>
          )}
        </Grid>
      </Grid>

      {(completeError || releaseError || rejectError) && (
        <Grid size={{ xs: 12 }}>
          <ErrorMessage error={completeError || releaseError || rejectError} />
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id='volunteer-child-tasks-table'
          title={`Claims (${(children as VolunteerTask[]).length})`}
          loading={isRequesting}
          data={children as VolunteerTask[]}
          error={loadError}
          columns={columns}
          rowId={(t: VolunteerTask) => t.id}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])}
          renderSearch={false}
        />
      </Grid>

      <ReasonModal title='Release Claim' isOpen={!!releaseTarget} onClose={() => setRelease(null)}
        onSubmit={reason => releaseTask({ id: releaseTarget, reason })}
        loading={releasing} error={releaseError} />

      <ReasonModal title='Reject Claim Completion' isOpen={!!rejectTarget} onClose={() => setReject(null)}
        onSubmit={reason => rejectTask({ id: rejectTarget, reason })}
        loading={rejecting} error={rejectError} />
    </Grid>
  );
};

const ChildTasksView = withQueryContext(ChildTasksViewInner);

// ── Main Tasks Tab ────────────────────────────────────────────────────────────

const TasksTabInner: React.FC = () => {
  const { canDeleteVolunteerRecords: isAdmin } = useCapabilities();

  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedIds, setSelectedIds]   = React.useState<string[]>([]);
  const [createOpen, setCreateOpen]     = React.useState(false);
  const [editTarget, setEditTarget]     = React.useState<VolunteerTask | null>(null);
  const [releaseTarget, setRelease]     = React.useState<string | null>(null);
  const [rejectTarget, setReject]       = React.useState<string | null>(null);
  // When set, renders the child drill-down view instead of the main table
  const [drillParent, setDrillParent]   = React.useState<VolunteerTask | null>(null);

  const { isRequesting, data: tasks = [], response, refresh, error: loadError } =
    useReadTransaction(
      adminListVolunteerTasks,
      { status: statusFilter || undefined, parentsOnly: statusFilter !== '' && statusFilter !== 'pending' },
      undefined,
      `volunteer-tasks-${statusFilter}`
    );

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setCreateOpen(false); setEditTarget(null);
    setRelease(null); setReject(null);
    setSelectedIds([]);
    refreshRef.current();
  }, []);

  const { call: createTask,      isRequesting: creating,       error: createError }      = useWriteTransaction(adminCreateVolunteerTask, onSuccess);
  const { call: updateTask,      isRequesting: updating,       error: updateError }      = useWriteTransaction(adminUpdateVolunteerTask, onSuccess);
  const { call: completeTask,    isRequesting: completing,     error: completeError }    = useWriteTransaction(adminCompleteVolunteerTask, onSuccess);
  const { call: cancelTask }     = useWriteTransaction(adminCancelVolunteerTask, onSuccess);
  const { call: deleteTask }     = useWriteTransaction(adminDeleteVolunteerTask, onSuccess);
  const { call: releaseTask,     isRequesting: releasing,      error: releaseError }     = useWriteTransaction(adminReleaseVolunteerTask, onSuccess);
  const { call: rejectTask,      isRequesting: rejecting,      error: rejectError }      = useWriteTransaction(adminRejectPendingVolunteerTask, onSuccess);
  const { call: resetCooldown,   isRequesting: resetting,      error: resetError }       = useWriteTransaction(adminResetTaskCooldown, onSuccess);

  const selectedTask = selectedIds.length === 1
    ? (tasks as VolunteerTask[]).find(t => t.id === selectedIds[0])
    : null;

  // Claim count per parent task id — derived from loaded tasks.
  // The admin index with parentsOnly=true doesn't include child docs, so we fetch
  // the count by passing children_only with a per-parent filter in the drill-down view.
  // For the summary column we show the info we do have: next_available as a proxy.

  if (drillParent) {
    return (
      <ChildTasksView
        parentTask={drillParent}
        onBack={() => { setDrillParent(null); refreshRef.current(); }}
        onActionSuccess={() => refreshRef.current()}
        isAdmin={isAdmin}
      />
    );
  }

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
          {MULTI_USE_STATUSES.includes(row.status) && (
            <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>
              <RepeatIcon style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }} />
              {row.status === 'recurring' && row.days != null
                ? `Every ${row.days} day${row.days !== 1 ? 's' : ''}`
                : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
              {row.isCoolingDown && row.nextAvailable && (
                <> — available {new Date(row.nextAvailable).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
              )}
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
        return (
          <div>
            <StatusLabel label={s.label} color={s.color} />
            {row.isCoolingDown && (
              <div><StatusLabel label='Cooling Down' color={Status.Warn} /></div>
            )}
          </div>
        );
      },
    },
    {
      id: 'claims',
      label: 'Claims',
      cell: (row: VolunteerTask) => {
        if (!MULTI_USE_STATUSES.includes(row.status)) return null;
        return (
          <Tooltip title='View individual claims for this task'>
            <Chip
              icon={<ListAltIcon />}
              label='View'
              size='small'
              clickable
              onClick={e => { e.stopPropagation(); setDrillParent(row); }}
            />
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormLabel>Filter by Status</FormLabel>
            <Select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as string); setSelectedIds([]); }}
              fullWidth displayEmpty>
              <MenuItem value=''>All</MenuItem>
              <MenuItem value='available'>Available</MenuItem>
              <MenuItem value='reusable'>Reusable</MenuItem>
              <MenuItem value='repeatable'>Repeatable</MenuItem>
              <MenuItem value='recurring'>Recurring</MenuItem>
              <MenuItem value='claimed'>Claimed</MenuItem>
              <MenuItem value='pending'>Pending Verification</MenuItem>
              <MenuItem value='completed'>Completed</MenuItem>
              <MenuItem value='cancelled'>Cancelled</MenuItem>
              <MenuItem value='denied'>Denied</MenuItem>
            </Select>
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <Grid container spacing={1} justifyContent='flex-end' alignItems='flex-end'>
              <Grid>
                <Button variant='contained' color='primary' size='small' startIcon={<AddIcon />}
                  onClick={() => setCreateOpen(true)}>
                  Create Task
                </Button>
              </Grid>
              {selectedTask && EDITABLE_STATUSES.includes(selectedTask.status) && (
                <Grid>
                  <Button variant='outlined' size='small' startIcon={<EditIcon />}
                    onClick={() => setEditTarget(selectedTask)}>
                    Edit
                  </Button>
                </Grid>
              )}
              {selectedTask?.status === 'pending' && (
                <>
                  <Grid>
                    <Button variant='contained' color='primary' size='small' startIcon={<CheckIcon />}
                      disabled={completing}
                      onClick={() => completeTask({ id: selectedTask.id })}>
                      Verify
                    </Button>
                  </Grid>
                  <Grid>
                    <Button variant='outlined' color='secondary' size='small' startIcon={<CloseIcon />}
                      onClick={() => setReject(selectedTask.id)}>
                      Reject
                    </Button>
                  </Grid>
                </>
              )}
              {selectedTask?.status === 'claimed' && (
                <Grid>
                  <Button variant='outlined' color='secondary' size='small'
                    onClick={() => setRelease(selectedTask.id)}>
                    Release
                  </Button>
                </Grid>
              )}
              {selectedTask?.status === 'recurring' && selectedTask.isCoolingDown && (
                <Grid>
                  <Tooltip title='Clear the cooldown so this task becomes immediately claimable again'>
                    <Button variant='outlined' size='small' startIcon={<RestoreIcon />}
                      disabled={resetting}
                      onClick={() => resetCooldown({ id: selectedTask.id })}>
                      Reset Cooldown
                    </Button>
                  </Tooltip>
                </Grid>
              )}
              {selectedTask && CANCELLABLE_STATUSES.includes(selectedTask.status) && (
                <Grid>
                  <Button variant='outlined' color='secondary' size='small' startIcon={<CloseIcon />}
                    onClick={() => cancelTask({ id: selectedTask.id })}>
                    Cancel
                  </Button>
                </Grid>
              )}
              {isAdmin && selectedIds.length > 0 &&
                (tasks as VolunteerTask[]).filter(t => selectedIds.includes(t.id))
                  .every(t => ['completed', 'cancelled', 'denied'].includes(t.status)) && (
                <Grid>
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

      {(completeError || releaseError || rejectError || resetError) && (
        <Grid size={{ xs: 12 }}>
          <ErrorMessage error={completeError || releaseError || rejectError || resetError} />
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
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
        onSave={form => createTask({ body: {
          title: form.title, description: form.description,
          creditValue: parseFloat(form.creditValue) || 1,
          status: form.taskType as VolunteerTaskStatus,
          days: form.taskType === 'recurring' ? parseInt(form.days, 10) || null : null,
        }})}
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
        <Grid size={{ xs: 12 }}>
          <TextField label='Title' value={title} onChange={e => setTitle(e.target.value)} fullWidth required autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField label='Description' value={description} onChange={e => setDescription(e.target.value)}
            fullWidth multiline rows={2} />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField label='Credit Value' value={creditValue} onChange={e => setCreditValue(e.target.value)}
            type='number' slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }} fullWidth required />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField label='Event Date' value={eventDate} onChange={e => setEventDate(e.target.value)}
            type='date' fullWidth slotProps={{ inputLabel: { shrink: true } }} />
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
      <MemberSearchInput name='event-attendee-search' placeholder='Search by name or email'
        initialSelection={selectedMember} onChange={setSelectedMember} />
    </FormModal>
  );
};

interface ManageAttendeesModalProps {
  event: VolunteerEvent | null;
  onClose: () => void;
  onRemove: (memberId: string) => void;
  removing: boolean;
  error: string;
}

const ManageAttendeesModal: React.FC<ManageAttendeesModalProps> = ({ event, onClose, onRemove, removing, error }) => {
  if (!event) return null;
  return (
    <FormModal id='manage-event-attendees' title={`Attendees — ${event.title}`}
      isOpen={!!event} closeHandler={onClose} onSubmit={onClose} submitText='Done'
      loading={false} error={error}>
      {event.attendeeIds.length === 0 ? (
        <Typography variant='body2' color='textSecondary'>No attendees checked in yet.</Typography>
      ) : (
        <List dense>
          {event.attendeeIds.map((id, index) => (
            <ListItem key={id} divider={index < event.attendeeIds.length - 1}>
              <ListItemText primary={event.attendeeNames[index] || id} />
              {event.status === 'open' && (
                <ListItemSecondaryAction>
                  <IconButton edge='end' size='small' disabled={removing} onClick={() => onRemove(id)} title='Remove check-in'>
                    <RemoveCircleIcon fontSize='small' color='error' />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </FormModal>
  );
};

const EventsTabInner: React.FC = () => {
  const { canDeleteVolunteerRecords: isAdmin } = useCapabilities();

  const [statusFilter, setStatusFilter]            = React.useState('open');
  const [selectedIds, setSelectedIds]              = React.useState<string[]>([]);
  const [createOpen, setCreateOpen]                = React.useState(false);
  const [addAttendeeTarget, setAddAttendee]        = React.useState<string | null>(null);
  const [manageAttendeesEvent, setManageAttendees] = React.useState<VolunteerEvent | null>(null);

  const { isRequesting, data: events = [], response, refresh, error: loadError } =
    useReadTransaction(adminListVolunteerEvents, { status: statusFilter || undefined }, undefined, `volunteer-events-${statusFilter}`);

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setCreateOpen(false); setAddAttendee(null); setSelectedIds([]);
    refreshRef.current();
  }, []);

  const onRemoveSuccess = React.useCallback(() => {
    refreshRef.current();
    setManageAttendees(prev => prev ? (events as VolunteerEvent[]).find(e => e.id === prev.id) || null : null);
  }, [events]);

  const { call: createEvent,    isRequesting: creating,         error: createError }         = useWriteTransaction(adminCreateVolunteerEvent, onSuccess);
  const { call: closeEvent,     isRequesting: closing,          error: closeError }          = useWriteTransaction(adminCloseVolunteerEvent, onSuccess);
  const { call: addAttendee,    isRequesting: addingAttendee,   error: addAttendeeError }    = useWriteTransaction(adminAddEventAttendee, onSuccess);
  const { call: removeAttendee, isRequesting: removingAttendee, error: removeAttendeeError } = useWriteTransaction(adminRemoveEventAttendee, onRemoveSuccess);
  const { call: deleteEvent }   = useWriteTransaction(adminDeleteVolunteerEvent, onSuccess);

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
    { id: 'creditValue', label: 'Credits', cell: (row: VolunteerEvent) => <Typography variant='body2'>{row.creditValue}</Typography> },
    { id: 'attendees',   label: 'Attendees', cell: (row: VolunteerEvent) => <Typography variant='body2'>{row.attendeeCount}</Typography> },
    {
      id: 'status',
      label: 'Status',
      cell: (row: VolunteerEvent) => { const s = eventStatusLabel(row.status); return <StatusLabel label={s.label} color={s.color} />; },
    },
  ];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormLabel>Filter by Status</FormLabel>
            <Select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as string); setSelectedIds([]); }}
              fullWidth displayEmpty>
              <MenuItem value=''>All</MenuItem>
              <MenuItem value='open'>Open</MenuItem>
              <MenuItem value='closed'>Closed</MenuItem>
            </Select>
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <Grid container spacing={1} justifyContent='flex-end' alignItems='flex-end'>
              <Grid>
                <Button variant='contained' color='primary' size='small' startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                  Create Event
                </Button>
              </Grid>
              {selectedEvent && (
                <Grid>
                  <Button variant='outlined' size='small' startIcon={<PeopleIcon />} onClick={() => setManageAttendees(selectedEvent)}>
                    Manage Attendees
                  </Button>
                </Grid>
              )}
              {selectedEvent?.status === 'open' && (
                <>
                  <Grid>
                    <Button variant='outlined' size='small' startIcon={<PersonAddIcon />} onClick={() => setAddAttendee(selectedEvent.id)}>
                      Add Attendee
                    </Button>
                  </Grid>
                  <Grid>
                    <Button variant='contained' color='primary' size='small' startIcon={<CheckIcon />}
                      disabled={closing} onClick={() => closeEvent({ id: selectedEvent.id })}>
                      Close Event
                    </Button>
                  </Grid>
                </>
              )}
              {isAdmin && selectedIds.length > 0 &&
                (events as VolunteerEvent[]).filter(e => selectedIds.includes(e.id)).every(e => e.status === 'closed') && (
                <Grid>
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
        <Grid size={{ xs: 12 }}><ErrorMessage error={closeError || addAttendeeError} /></Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id='volunteer-events-table' title='Volunteer Events'
          loading={isRequesting} data={events as VolunteerEvent[]} error={loadError}
          columns={columns} rowId={(e: VolunteerEvent) => e.id}
          totalItems={extractTotalItems(response)} selectedIds={selectedIds}
          setSelectedIds={(ids: unknown) => setSelectedIds(ids as string[])} renderSearch={true}
        />
      </Grid>

      <CreateEventModal isOpen={createOpen} onClose={() => setCreateOpen(false)}
        onSave={event => createEvent({ body: { title: event.title, description: event.description, creditValue: event.creditValue, eventDate: event.eventDate } })}
        loading={creating} error={createError} />

      <AddAttendeeModal eventId={addAttendeeTarget} onClose={() => setAddAttendee(null)}
        onAdd={memberId => addAttendee({ id: addAttendeeTarget, memberId })}
        loading={addingAttendee} error={addAttendeeError} />

      <ManageAttendeesModal event={manageAttendeesEvent} onClose={() => setManageAttendees(null)}
        onRemove={memberId => removeAttendee({ id: manageAttendeesEvent.id, memberId })}
        removing={removingAttendee} error={removeAttendeeError} />
    </Grid>
  );
};

const EventsTab = withQueryContext(EventsTabInner);

// ── Main Page ─────────────────────────────────────────────────────────────────

const AdminVolunteerPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('credits');

  return (
    <Grid container spacing={3} justifyContent='center'>
      <Grid size={{ xs: 12, md: 10 }}>
        <Typography variant='h5' gutterBottom>Volunteer</Typography>
        <Typography variant='body2' color='textSecondary'>
          Manage volunteer credits, bounty tasks, and events.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 10 }}>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val as TabKey)}
          indicatorColor='primary' textColor='primary' variant='scrollable' scrollButtons='auto'>
          {TABS.map(t => <Tab key={t.key} id={`volunteer-tab-${t.key}`} value={t.key} label={t.label} />)}
        </Tabs>
      </Grid>
      <Grid size={{ xs: 12, md: 10 }}>
        {activeTab === 'credits' && <CreditsTab />}
        {activeTab === 'tasks'   && <TasksTab />}
        {activeTab === 'events'  && <EventsTab />}
      </Grid>
    </Grid>
  );
};

export default AdminVolunteerPage;
