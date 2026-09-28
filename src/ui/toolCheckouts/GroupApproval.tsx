import * as React from 'react';
import { Alert, Chip, Stack, Typography } from '@mui/material';
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
  React.useEffect(() => {
    let active = true;
    reviewToolGroup(group.id, memberId).then(result => {
      if (!active) return;
      if (result.error) setError(result.error.message); else setReview(result.data || null);
    });
    return () => { active = false; };
  }, [group.id, memberId]);
  const submit = async () => {
    if (!review || review.missingPrerequisiteIds.length || !review.createToolIds.length) return;
    setSaving(true);
    const result = await approveToolGroup(group.id, memberId, review.revision, requestId);
    setSaving(false);
    if (result.error) { setError(result.error.message); if (result.error.status === 409) setReview(null); }
    else onSaved();
  };
  return <FormModal id="approve-group" isOpen title={`Approve ${group.name}`} closeHandler={onClose}
    onSubmit={submit} submitText="Approve group" loading={saving || (!review && !error)} error={error}>
    <Stack spacing={2}>
      <Chip label="Group" size="small" sx={{ alignSelf: 'flex-start' }} />
      {review && <GroupDetails group={review.group} />}
      {review && <>
        <Typography>Already held: {review.group.includedTools.filter(tool => review.heldToolIds.includes(tool.id)).map(tool => tool.name).join(', ') || 'None'}</Typography>
        <Typography>New checkouts: {review.group.includedTools.filter(tool => review.createToolIds.includes(tool.id)).map(tool => tool.name).join(', ') || 'None'}</Typography>
        <Typography>External prerequisites: {review.prerequisiteNames.join(', ') || 'None'}</Typography>
        {!!review.missingPrerequisiteIds.length && <Alert severity="error">Complete all prerequisite checkouts before approval.</Alert>}
        {!review.createToolIds.length && <Alert severity="info">All included tools already have active checkouts.</Alert>}
      </>}
    </Stack>
  </FormModal>;
}
