import * as React from 'react';
import { Alert, Button, Chip, Stack, Typography } from '@mui/material';
import { GroupCheckoutReview, ToolGroup } from 'app/entities/toolCheckout';
import { approveToolGroup, reviewToolGroup } from 'api/toolCheckouts';
import FormModal from 'ui/common/FormModal';
import { GroupDetails } from './ToolGroupList';

export default function GroupApproval({ group, memberId, requestId, onClose, onSaved }: {
  group: ToolGroup; memberId: string; requestId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [review, setReview] = React.useState<GroupCheckoutReview | null>(null);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setReview(null);
    setLoadError('');
    setError('');
    setLoading(true);
    reviewToolGroup(group.id, memberId).then(result => {
      if (!active) return;
      if (result.error || !result.data) setLoadError(result.error?.message || 'Unable to load group review.');
      else setReview(result.data);
    }).catch(() => { if (active) setLoadError('Unable to load group review.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.id, memberId, attempt]);
  const submit = async () => {
    if (!review || review.missingPrerequisiteIds.length || (!review.createToolIds.length && !requestId)) return;
    setSaving(true);
    const result = await approveToolGroup(group.id, memberId, review.revision, requestId);
    setSaving(false);
    if (result.error) {
      if (result.error.status === 409) { setReview(null); setLoadError(result.error.message); setError(''); }
      else setError(result.error.message);
    }
    else onSaved();
  };
  return <FormModal id="approve-group" isOpen title={`Approve ${group.name}`} closeHandler={onClose}
    onSubmit={submit} submitText={review && !review.createToolIds.length && requestId ? 'Resolve request' : 'Approve group'}
    submitDisabled={loading || !review || !!review.missingPrerequisiteIds.length || (!review.createToolIds.length && !requestId)} loading={saving} error={error}>
    <Stack spacing={2}>
      {loading && <Typography role="status">Loading group review…</Typography>}
      {loadError && <Alert severity="error">{loadError}
        <Button color="inherit" onClick={() => setAttempt(value => value + 1)}>Retry review</Button>
      </Alert>}
      <Chip label="Group" size="small" sx={{ alignSelf: 'flex-start' }} />
      {review && <GroupDetails group={review.group} />}
      {review && <>
        <Typography>Already held: {review.group.includedTools.filter(tool => review.heldToolIds.includes(tool.id)).map(tool => tool.name).join(', ') || 'None'}</Typography>
        <Typography>New checkouts: {review.group.includedTools.filter(tool => review.createToolIds.includes(tool.id)).map(tool => tool.name).join(', ') || 'None'}</Typography>
        <Typography>External prerequisites: {review.prerequisiteNames.join(', ') || 'None'}</Typography>
        {!!review.missingPrerequisiteIds.length && <Alert severity="error">Complete all prerequisite checkouts before approval.</Alert>}
        {!review.createToolIds.length && <Alert severity="info">All included tools already have active checkouts.{requestId && ' Resolve this request without creating new checkouts.'}</Alert>}
      </>}
    </Stack>
  </FormModal>;
}
