import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Select from "@mui/material/Select";
import FormLabel from "@mui/material/FormLabel";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import LoadingOverlay from "ui/common/LoadingOverlay";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { withQueryContext } from "ui/common/Filters/QueryContext";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import extractTotalItems from "ui/utils/extractTotalItems";
import { Shop, Tool } from "app/entities/toolCheckout";
import {
  listShops, listTools,
  adminCreateTool, adminUpdateTool, adminDeleteTool,
} from "api/toolCheckouts";

const rowId = (t: Tool) => t.id;

const normalizedName = (value: string) => value.trim().toLowerCase();

const duplicateToolName = (tools: Tool[], name: string, shopId: string, excludeId?: string) => {
  const target = normalizedName(name);
  return !!target && tools.some(t =>
    t.shopId === shopId && t.id !== excludeId && normalizedName(t.name) === target
  );
};

const wouldCreatePrerequisiteLoop = (
  tools: Tool[],
  toolId: string | undefined,
  prerequisiteIds: string[]
) => {
  if (!toolId) return false;

  const byId = new Map(tools.map(t => [t.id, t]));
  const stack = [...prerequisiteIds];
  const visited = new Set<string>();

  while (stack.length) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === toolId) return true;

    visited.add(currentId);
    const currentTool = byId.get(currentId);
    currentTool?.prerequisiteIds?.forEach(id => stack.push(id));
  }

  return false;
};

// ── AddToolModal ──────────────────────────────────────────────────────────────

interface AddToolModalProps {
  shops: Shop[];
  tools: Tool[];
  onClose: () => void;
  onSave: (body: Partial<Tool>) => void;
  loading: boolean;
  error: string;
}

const AddToolModal: React.FC<AddToolModalProps> = ({ shops, tools, onClose, onSave, loading, error }) => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [shopId, setShopId] = React.useState(shops[0]?.id || "");
  const [prerequisiteIds, setPrerequisiteIds] = React.useState<string[]>([]);
  const [disabled, setDisabled] = React.useState(false);
  const [announce, setAnnounce] = React.useState(false);
  const [announceChannel, setAnnounceChannel] = React.useState("");
  const [usersChannel, setUsersChannel] = React.useState("");
  const [localError, setLocalError] = React.useState("");

  const togglePrereq = (id: string) =>
    setPrerequisiteIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const availablePrereqs = tools.filter(t => t.shopId === shopId);
  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || !shopId) return;

    if (duplicateToolName(tools, trimmedName, shopId)) {
      setLocalError("A tool with this name already exists in the selected shop.");
      return;
    }

    setLocalError("");
    onSave({ name: trimmedName, description, shopId, prerequisiteIds, disabled, announce, announceChannel, usersChannel });
  };

  return (
    <FormModal id="add-tool" isOpen={true} title="Add Tool"
      closeHandler={onClose}
      onSubmit={submit}
      submitText="Add Tool" loading={loading} error={localError || error}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <FormLabel style={{ fontSize: 12 }}>Shop *</FormLabel>
          <Select native fullWidth value={shopId}
            onChange={e => { setShopId((e.target as HTMLSelectElement).value); setPrerequisiteIds([]); }}>
            <option value="">— select shop —</option>
            {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth required label="Tool Name" placeholder="e.g. Bandsaw"
            value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Description" placeholder="Optional details"
            value={description} onChange={e => setDescription(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControlLabel control={<Checkbox checked={disabled} onChange={e => setDisabled(e.target.checked)} />}
            label="Hidden" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControlLabel control={<Checkbox checked={announce} onChange={e => setAnnounce(e.target.checked)} />}
            label="Announce requests and checkouts" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth label="Announce Channel" placeholder="name or ID"
            value={announceChannel} onChange={e => setAnnounceChannel(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField fullWidth label="Users Channel" placeholder="name or ID"
            value={usersChannel} onChange={e => setUsersChannel(e.target.value)} />
        </Grid>
        {availablePrereqs.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <FormLabel style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Prerequisites (warning shown if not met — not a hard block)
            </FormLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {availablePrereqs.map(t => (
                <Chip key={t.id} label={t.name} size="small" clickable
                  onClick={() => togglePrereq(t.id)}
                  color={prerequisiteIds.includes(t.id) ? "primary" : "default"}
                  variant={prerequisiteIds.includes(t.id) ? "default" : "outlined"}
                />
              ))}
            </div>
          </Grid>
        )}
      </Grid>
    </FormModal>
  );
};

// ── EditToolRow ───────────────────────────────────────────────────────────────

interface EditToolRowProps {
  tool: Tool;
  tools: Tool[];
  onSave: (id: string, body: Partial<Tool>) => void;
  onCancel: () => void;
  saving: boolean;
}

const EditToolRow: React.FC<EditToolRowProps> = ({ tool, tools, onSave, onCancel, saving }) => {
  const [name, setName] = React.useState(tool.name);
  const [description, setDescription] = React.useState(tool.description || "");
  const [prerequisiteIds, setPrerequisiteIds] = React.useState<string[]>(tool.prerequisiteIds || []);
  const [disabled, setDisabled] = React.useState(!!tool.disabled);
  const [announce, setAnnounce] = React.useState(!!tool.announce);
  const [announceChannel, setAnnounceChannel] = React.useState(tool.announceChannel || "");
  const [usersChannel, setUsersChannel] = React.useState(tool.usersChannel || "");
  const [localError, setLocalError] = React.useState("");

  const availablePrereqs = tools.filter(t => t.shopId === tool.shopId && t.id !== tool.id);
  const togglePrereq = (id: string) => {
    const nextIds = prerequisiteIds.includes(id)
      ? prerequisiteIds.filter(p => p !== id)
      : [...prerequisiteIds, id];

    if (wouldCreatePrerequisiteLoop(tools, tool.id, nextIds)) {
      setLocalError("That prerequisite would create a dependency loop.");
      return;
    }

    setLocalError("");
    setPrerequisiteIds(nextIds);
  };

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (duplicateToolName(tools, trimmedName, tool.shopId, tool.id)) {
      setLocalError("A tool with this name already exists in this shop.");
      return;
    }

    if (wouldCreatePrerequisiteLoop(tools, tool.id, prerequisiteIds)) {
      setLocalError("These prerequisites would create a dependency loop.");
      return;
    }

    setLocalError("");
    onSave(tool.id, { name: trimmedName, description, disabled, announce, announceChannel, usersChannel, prerequisiteIds });
  };

  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", alignItems: "center" }}>
      <TextField size="small" value={name} onChange={e => setName(e.target.value)}
        placeholder="Tool name" autoFocus />
      <TextField size="small" value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Description" />
      <TextField size="small" value={announceChannel} onChange={e => setAnnounceChannel(e.target.value)}
        placeholder="Announce channel" />
      <TextField size="small" value={usersChannel} onChange={e => setUsersChannel(e.target.value)}
        placeholder="Users channel" />
      <FormControlLabel control={<Checkbox checked={disabled} onChange={e => setDisabled(e.target.checked)} />} label="Hidden" />
      <FormControlLabel control={<Checkbox checked={announce} onChange={e => setAnnounce(e.target.checked)} />} label="Announce" />
      <div style={{ gridColumn: "1 / -1" }}>
        <FormLabel style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Prerequisites</FormLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {availablePrereqs.length ? availablePrereqs.map(t => (
            <Chip key={t.id} label={t.name} size="small" clickable
              onClick={() => togglePrereq(t.id)}
              color={prerequisiteIds.includes(t.id) ? "primary" : "default"}
              variant={prerequisiteIds.includes(t.id) ? "default" : "outlined"}
            />
          )) : (
            <Typography variant="caption" color="textSecondary">No other tools in this shop.</Typography>
          )}
        </div>
        {localError && <Typography variant="caption" color="error">{localError}</Typography>}
      </div>
      <div>
        <Tooltip title="Save"><span>
          <IconButton size="small" color="primary" disabled={saving || !name}
            onClick={submit}>
            <SaveIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
        <Tooltip title="Cancel">
          <IconButton size="small" onClick={onCancel}><CancelIcon fontSize="small" /></IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

// ── DeleteToolModal ───────────────────────────────────────────────────────────

interface DeleteToolModalProps {
  target: Tool | null;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  error: string;
}

const DeleteToolModal: React.FC<DeleteToolModalProps> = ({ target, onClose, onDelete, loading, error }) => (
  <FormModal id="delete-tool" isOpen={!!target} title="Delete Tool"
    closeHandler={onClose} onSubmit={onDelete} submitText="Delete" loading={loading} error={error}>
    {target && (
      <Typography>
        Delete <strong>{target.name}</strong> from <strong>{target.shopName}</strong>?
        Existing checkout records will be preserved.
      </Typography>
    )}
  </FormModal>
);

// ── ToolManager ───────────────────────────────────────────────────────────────

const ToolManager: React.FC = () => {
  const [addOpen,      setAddOpen]      = React.useState(false);
  const [editingId,    setEditingId]    = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Tool | null>(null);
  const [shopFilter,   setShopFilter]   = React.useState<string>("");
  const [selectedId,   setSelectedId]   = React.useState<string | undefined>(undefined);

  const { data: shops = [] } = useReadTransaction(listShops, {}, undefined, "shops-for-tools");
  const { isRequesting, data: tools = [], response, refresh, error: loadError } =
    useReadTransaction(listTools, { shopId: shopFilter || undefined }, undefined, `tools-list-${shopFilter}`);
  const { data: allTools = [] } =
    useReadTransaction(listTools, {}, undefined, "tools-all-validation");

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const selectedTool = (tools as Tool[]).find(t => t.id === selectedId);

  const onSuccess = React.useCallback(() => {
    setAddOpen(false); setEditingId(null); setDeleteTarget(null);
    setSelectedId(undefined); refreshRef.current();
  }, []);

  const { call: createTool, isRequesting: creating, error: createError } = useWriteTransaction(adminCreateTool, onSuccess);
  const { call: updateTool, isRequesting: updating, error: updateError } = useWriteTransaction(adminUpdateTool, onSuccess);
  const { call: deleteTool, isRequesting: deleting, error: deleteError } = useWriteTransaction(adminDeleteTool, onSuccess);

  const handleSave = React.useCallback((id: string, body: Partial<Tool>) => {
    updateTool({ id, body });
  }, [updateTool]);

  const handleCancel = React.useCallback(() => {
    setEditingId(null);
    setSelectedId(undefined);
  }, []);

  const handleSelectId = React.useCallback((id: string | undefined) => {
    setEditingId(null);
    setSelectedId(id);
  }, []);

  const columns: Column<Tool>[] = [
    {
      id: "name", label: "Tool",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: Tool) => editingId === row.id
        ? <EditToolRow tool={row} tools={allTools as Tool[]} onSave={handleSave} onCancel={handleCancel} saving={updating} />
        : (
          <div>
            <Typography variant="body2"><strong>{row.name}</strong></Typography>
            {row.description && <Typography variant="caption" color="textSecondary">{row.description}</Typography>}
          </div>
        ),
    },
    {
      id: "shopName", label: "Shop",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: Tool) => editingId === row.id ? null : <span>{row.shopName}</span>,
    },
    {
      id: "prerequisites", label: "Prerequisites",
      cell: (row: Tool) => editingId === row.id ? null : (
        <span style={{ color: row.prerequisiteNames?.length ? "inherit" : "#aaa" }}>
          {row.prerequisiteNames?.length ? row.prerequisiteNames.join(", ") : "None"}
        </span>
      ),
    },
    {
      id: "settings", label: "Settings",
      cell: (row: Tool) => editingId === row.id ? null : (
        <span>
          {row.disabled ? "Hidden" : "Visible"}{row.announce ? ", announces" : ""}{row.usersChannel ? `, users: ${row.usersChannel}` : ""}
        </span>
      ),
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h6">Tools</Typography>
            <Typography variant="body2" color="textSecondary">
              Manage tools within each shop. Tools with the same name in different shops are tracked independently.
            </Typography>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedTool && !editingId && (
              <>
                <Button variant="outlined" color="primary" startIcon={<EditIcon />}
                  onClick={() => setEditingId(selectedTool.id)}>
                  Edit
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />}
                  onClick={() => setDeleteTarget(selectedTool)}>
                  Delete
                </Button>
              </>
            )}
            <Button variant="contained" color="primary" startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}>
              Add Tool
            </Button>
          </div>
        </Grid>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <FormLabel style={{ fontSize: 12 }}>Filter by Shop</FormLabel>
        <Select native fullWidth value={shopFilter}
          onChange={e => setShopFilter((e.target as HTMLSelectElement).value)}>
          <option value="">All Shops</option>
          {(shops as Shop[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Grid>

      {(loadError || updateError) && <Grid size={{ xs: 12 }}><ErrorMessage error={loadError || updateError} /></Grid>}

      <Grid size={{ xs: 12 }} style={{ position: "relative" }}>
        <StatefulTable
          id="tools-table" title="Tools" loading={isRequesting}
          data={tools as Tool[]} error={loadError} columns={columns}
          rowId={rowId} totalItems={extractTotalItems(response)}
          selectedIds={selectedId} setSelectedIds={handleSelectId}
          renderSearch={true}
        />
        {updating && <LoadingOverlay id="tool-saving" contained />}
      </Grid>

      {addOpen && (
        <AddToolModal
          shops={shops as Shop[]} tools={allTools as Tool[]}
          onClose={() => setAddOpen(false)}
          onSave={(body) => createTool({ body })}
          loading={creating} error={createError}
        />
      )}

      <DeleteToolModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={() => deleteTarget && deleteTool({ id: deleteTarget.id })}
        loading={deleting} error={deleteError}
      />
    </Grid>
  );
};

export default withQueryContext(ToolManager);
