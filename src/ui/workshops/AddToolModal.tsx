import * as React from 'react';
import { Alert, Button, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import ToolEditorModal from 'ui/toolCheckouts/ToolEditorModal';
import { listTools, listManagedShops } from 'api/toolCheckouts';
import { Shop, Tool } from 'app/entities/toolCheckout';
import { Workshop } from 'app/entities/workshop';

export const AddToolModal: React.FC<{ workshop: Workshop; onClose: () => void; onCreated: () => void }> = ({ workshop, onClose, onCreated }) => {
  const [tools, setTools] = React.useState<Tool[]>([]);
  const [shops, setShops] = React.useState<Shop[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setShops([]);
    Promise.all([listTools({ shopId: workshop.id }), listManagedShops()]).then(([toolResult, shopResult]) => {
      if (!active) return;
      if (toolResult.error || shopResult.error) setError(toolResult.error?.message || shopResult.error?.message || 'Unable to load tools');
      else { setTools(toolResult.data || []); setShops((shopResult.data || []).filter(shop => shop.id === workshop.id)); }
    }).catch(() => { if (active) setError('Unable to load tools'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workshop.id, attempt]);
  if (loading || !shops.length) return <Dialog open onClose={onClose} aria-labelledby="workshop-add-tool-title">
    <DialogTitle id="workshop-add-tool-title">Add Tool</DialogTitle><DialogContent>
      {loading ? <Typography role="status">Loading tools…</Typography> : <>
        <Alert severity="error">{error || 'This workshop is unavailable for tool management.'}</Alert>
        <Button onClick={() => setAttempt(value => value + 1)}>Retry resources</Button>
      </>}
      <Button onClick={onClose}>Cancel</Button>
    </DialogContent></Dialog>;
  return <ToolEditorModal shops={shops} tools={tools} initialShopId={workshop.id}
    onClose={onClose} onSaved={onCreated} />;
};

export default AddToolModal;
