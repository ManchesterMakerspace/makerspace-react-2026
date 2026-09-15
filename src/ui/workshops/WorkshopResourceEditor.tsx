import * as React from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Shop, Tool } from 'app/entities/toolCheckout';
import { listManagedShops, listTools, adminUpdateShop, adminUpdateTool, adminUpdateToolNotes } from 'api/toolCheckouts';
import { EditShopModal } from 'ui/toolCheckouts/EditShopModal';
import { EditToolRow } from 'ui/toolCheckouts/EditToolRow';

// Load the same complete, permission-scoped records used by /tool-checkouts.
// Workshop summaries deliberately omit management settings and sensitive notes.
export default function WorkshopResourceEditor({ shopId, toolId, onClose, onSaved }: {
  shopId: string; toolId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [catalog, setCatalog] = React.useState<{ shops: Shop[]; tools: Tool[] }>();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setCatalog(undefined);
    Promise.all([listManagedShops(), listTools()]).then(([shops, tools]) => {
      if (cancelled) return;
      const failure = shops.error?.message || tools.error?.message;
      if (failure) { setError(failure); return; }
      const shop = shops.data?.find(item => item.id === shopId);
      const tool = tools.data?.find(item => item.id === toolId && item.shopId === shopId);
      if (!shop || (toolId && !tool)) {
        setError('This resource is no longer available to edit. Close this dialog and refresh the workshops.');
        return;
      }
      setCatalog({ shops: shops.data!, tools: tools.data! });
    }).catch(error => { if (!cancelled) setError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shopId, toolId, attempt]);

  const save = async (id: string, body: Partial<Shop> | Partial<Tool>, notes?: string) => {
    setSaving(true); setError('');
    try {
      const result = toolId ? await adminUpdateTool({ id, body: body as Partial<Tool> })
        : await adminUpdateShop({ id, body: body as Partial<Shop> });
      if (result.error) { setError(result.error.message); return; }
      if (toolId && notes !== undefined) {
        const result = await adminUpdateToolNotes({ id, notes });
        if (result.error) {
          setError(`Tool settings saved, but notes could not be saved: ${result.error.message}`);
          return;
        }
      }
      onSaved();
    } catch (error: any) { setError(error.message); }
    finally { setSaving(false); }
  };
  const close = () => { if (!saving) onClose(); };
  const shop = catalog?.shops.find(item => item.id === shopId);
  const tool = catalog?.tools.find(item => item.id === toolId);
  if (catalog && shop && !toolId) return <EditShopModal shop={shop}
    tools={catalog.tools.filter(item => item.shopId === shopId)} onSave={save}
    onCancel={close} saving={saving} error={error} />;
  return <Dialog open fullWidth maxWidth="md" onClose={close} aria-labelledby="workshop-resource-editor-title">
    <DialogTitle id="workshop-resource-editor-title">{tool ? `Edit ${tool.name}` : 'Load editor'}</DialogTitle>
    <DialogContent>
      {loading && <CircularProgress aria-label="Loading management settings" />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {catalog && tool && <EditToolRow tool={tool} shops={catalog.shops} tools={catalog.tools}
        onSave={save} onCancel={close} saving={saving} />}
    </DialogContent>
    {!catalog && <DialogActions>
      {!loading && <Button onClick={() => setAttempt(value => value + 1)}>Retry</Button>}
      <Button onClick={close}>Close</Button>
    </DialogActions>}
  </Dialog>;
}
