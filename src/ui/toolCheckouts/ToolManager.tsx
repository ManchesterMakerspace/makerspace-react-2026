// @ts-nocheck
import ToolAvailability from "ui/common/ToolAvailability";
import ToolOutageAction from "ui/fixTickets/ToolOutageAction";
import * as React from "react";
import ToolGroupList from './ToolGroupList';
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Select from "@mui/material/Select";
import FormLabel from "@mui/material/FormLabel";
import QrCodeIcon from "@mui/icons-material/QrCode";
import ToolAnnotationCell from "./ToolAnnotationCell";
import ToolQrCodeModal from "./ToolQrCodeModal";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { withQueryContext } from "ui/common/Filters/QueryContext";
import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { Shop, Tool } from "app/entities/toolCheckout";
import {
  adminDeleteTool, adminUpdateToolNotes,
} from "api/toolCheckouts";
import ToolEditorModal from "./ToolEditorModal";

const rowId = (t: Tool) => t.id;

// ── NotesCell ─────────────────────────────────────────────────────────────────
// Separate from the full tool editor: a checkout approver for this
// tool may set notes (e.g. lock combo) even if they can't edit anything
// else about the tool -- see #189. `tool.notes` is only present at all when
// the backend has decided this viewer may see it.

interface NotesCellProps {
  tool: Tool;
  onSaved: () => void;
}

const NotesCell: React.FC<NotesCellProps> = ({ tool, onSaved }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(tool.notes || "");
  const { call: saveNotes, isRequesting, error } = useWriteTransaction(adminUpdateToolNotes, () => {
    setEditing(false);
    onSaved();
  });

  if (tool.notes === undefined && !editing) {
    return <Typography variant="caption" color="textSecondary">—</Typography>;
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>{tool.notes || "None"}</Typography>
        <Tooltip title="Edit notes">
          <IconButton size="small" onClick={() => { setValue(tool.notes || ""); setEditing(true); }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
      <TextField size="small" multiline value={value} autoFocus
        placeholder="e.g. lock combo" onChange={e => setValue(e.target.value)} />
      <Tooltip title="Save"><span>
        <IconButton size="medium" color="primary" disabled={isRequesting}
          onClick={() => saveNotes({ id: tool.id, notes: value })}>
          <SaveIcon fontSize="medium" />
        </IconButton>
      </span></Tooltip>
      <Tooltip title="Cancel">
        <IconButton size="small" onClick={() => setEditing(false)}><CancelIcon fontSize="small" /></IconButton>
      </Tooltip>
      {error && <ErrorMessage error={error} />}
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

const ToolManager: React.FC<{ onPlaceOnMap?: (shopId: string, toolId: string) => void }> = ({ onPlaceOnMap }) => {
  const [qrTool, setQrTool] = React.useState<Tool | null>(null);
  const [addOpen,      setAddOpen]      = React.useState(false);
  const [editingId,    setEditingId]    = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Tool | null>(null);
  const [shopFilter,   setShopFilter]   = React.useState<string>("");
  const [selectedId,   setSelectedId]   = React.useState<string | undefined>(undefined);

  const { data: shops = [], isRequesting: shopsLoading, error: shopsError } = useCheckoutCatalog("managedShops");
  const { isRequesting, data: allTools = [], refresh, error: loadError } =
    useCheckoutCatalog("tools");
  const tools = shopFilter ? allTools.filter(tool => tool.shopId === shopFilter) : allTools;
  // GET /api/admin/tools is already correctly scoped server-side (shop
  // manager, or a checkout approver's specific tool_ids) -- do not re-filter
  // against listManagedShops here, which only covers actual shop managers
  // and would otherwise hide tools for a tool-only (non-shop) approver (#189).
  const manageableTools = tools as Tool[];
  const allManageableTools = allTools as Tool[];

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const selectedTool = manageableTools.find(t => t.id === selectedId);
  const editingTool = allManageableTools.find(tool => tool.id === editingId);
  // Full edit/delete stays restricted to actual shop managers -- a tool-only
  // checkout approver can only reach the Notes field (see NotesCell), since
  // the backend rejects any other field change from them (#189).
  const managedShopIds = new Set((shops as Shop[]).map(s => s.id));
  const canFullyManageSelected = !!selectedTool && managedShopIds.has(selectedTool.shopId);

  const onSuccess = React.useCallback(() => {
    setAddOpen(false); setEditingId(null); setDeleteTarget(null);
    setSelectedId(undefined);
    refreshRef.current();
  }, []);

  const { call: deleteTool, isRequesting: deleting, error: deleteError } = useWriteTransaction(adminDeleteTool, onSuccess);
  const handleSelectId = React.useCallback((id: string | undefined) => {
    setEditingId(null);
    setSelectedId(id);
  }, []);

  const columns: Column<Tool>[] = [
    {
      id: "name", label: "Tool",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: Tool) => (
          <div>
            <Typography variant="body2"><strong>{row.name}</strong></Typography>
            {row.description && <Typography variant="caption" color="textSecondary">{row.description}</Typography>}
          </div>
        ),
    },
    {
      id: "shopName", label: "Shop",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: Tool) => <span>{row.shopName}</span>,
    },
    {
      id: "locationName", label: "Location",
      cell: (row: Tool) => (
        <span style={{ color: row.locationName ? "inherit" : "#aaa" }}>{row.locationName || "—"}</span>
      ),
    },
    {
      id: "prerequisites", label: "Prerequisites",
      cell: (row: Tool) => (
        <span style={{ color: row.prerequisiteNames?.length ? "inherit" : "#aaa" }}>
          {row.prerequisiteNames?.length ? row.prerequisiteNames.join(", ") : "None"}
        </span>
      ),
    },
    {
      id: "settings", label: "Settings",
      cell: (row: Tool) => (
        <span>
          <ToolAvailability outOfService={row.outOfService} />{managedShopIds.has(row.shopId) && <ToolOutageAction tool={row} onSaved={() => { refreshRef.current(); }} />}{row.disabled ? "Hidden" : "Visible"}{row.announce ? ", announces" : ""}{row.usersChannel ? `, users: ${row.usersChannel}` : ""}
          {row.reservable ? `, reservable (${row.maxConcurrentReservations || 1} concurrent)` : ", not reservable"}
        </span>
      ),
    },
    {
      id: "requestorAnnotation", label: "Annotation for requestors",
      cell: (row: Tool) => <ToolAnnotationCell tool={row} onSaved={() => refreshRef.current()} />,
    },
    {
      id: "notes", label: "Notes",
      cell: (row: Tool) => (
        <NotesCell tool={row} onSaved={() => refreshRef.current()} />
      ),
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center" sx={{ columnGap: 2, rowGap: 1.5 }}>
          <div>
            <Typography variant="h6">Tools</Typography>
            <Typography variant="body2" color="textSecondary">
              Manage tools within each shop. Tools with the same name in different shops are tracked independently.
            </Typography>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {/* The API scopes this list to tools the user can manage or approve. */}
            {selectedTool && (
              <Button variant="outlined" color="primary" startIcon={<QrCodeIcon />}
                onClick={() => setQrTool(selectedTool)}>QR Code</Button>
            )}
            {selectedTool && !editingId && canFullyManageSelected && (
              <>
                <Button variant="outlined" color="primary" startIcon={<EditIcon />}
                  disabled={isRequesting || shopsLoading || !!loadError || !!shopsError}
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
              disabled={!shops.length || isRequesting || shopsLoading || !!loadError || !!shopsError} onClick={() => setAddOpen(true)}>
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

      {(loadError || shopsError) && <Grid size={{ xs: 12 }}><ErrorMessage error={loadError || shopsError} /></Grid>}

      <Grid size={{ xs: 12 }} style={{ position: "relative" }}>
        <StatefulTable
          id="tools-table" title="Tools" loading={isRequesting}
          data={manageableTools} error={loadError} columns={columns}
          rowId={rowId} totalItems={manageableTools.length}
          selectedIds={selectedId} setSelectedIds={handleSelectId}
          renderSearch={true}
        />
      </Grid>

      {(addOpen || editingTool) && <ToolEditorModal
        key={editingId || "new"}
        tool={editingTool}
        shops={shops as Shop[]} tools={allManageableTools}
        initialShopId={shopFilter || undefined}
        onClose={() => { setAddOpen(false); setEditingId(null); }}
        onSaved={onSuccess} onPlaceOnMap={onPlaceOnMap}
      />}

      <Grid size={{ xs: 12 }}><ToolGroupList shops={shops as Shop[]} tools={allManageableTools} shopId={shopFilter || undefined} /></Grid>

      {qrTool && <ToolQrCodeModal key={qrTool.id} tool={qrTool} onClose={() => setQrTool(null)} />}

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
