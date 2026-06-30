import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import FormLabel from "@mui/material/FormLabel";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { withQueryContext } from "ui/common/Filters/QueryContext";
import StatusLabel from "ui/common/StatusLabel";
import { Status } from "ui/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import extractTotalItems from "ui/utils/extractTotalItems";
import { AvailableTool, Shop, ToolCheckoutRequest } from "app/entities/toolCheckout";
import {
  adminListToolCheckoutRequests,
  createToolCheckoutRequest,
  deleteToolCheckoutRequest,
  listAvailableToolsForCheckoutRequest,
  listShops,
  listToolCheckoutRequests,
  updateToolCheckoutRequest,
} from "api/toolCheckouts";

const rowId = (request: ToolCheckoutRequest) => request.id;
const NOTE_LIMIT = 128;

interface RequestModalProps {
  availableTools: AvailableTool[];
  shops: Shop[];
  target?: ToolCheckoutRequest;
  onClose: () => void;
  onSave: (body: { toolId?: string; note: string }) => void;
  loading: boolean;
  error: string;
}

const RequestModal: React.FC<RequestModalProps> = ({ availableTools, shops, target, onClose, onSave, loading, error }) => {
  const [shopId, setShopId] = React.useState(target?.shopId || "");
  const [toolId, setToolId] = React.useState(target?.toolId || "");
  const [note, setNote] = React.useState(target?.note || "");

  const shopTools = availableTools.filter(t => !shopId || t.shopId === shopId);
  const selectedTool = availableTools.find(t => t.id === toolId);
  const noteTooLong = note.length > NOTE_LIMIT;

  return (
    <FormModal
      id={target ? "edit-tool-checkout-request" : "create-tool-checkout-request"}
      isOpen={true}
      title={target ? "Edit Checkout Request Note" : "Request Tool Checkout"}
      closeHandler={onClose}
      onSubmit={() => !noteTooLong && (target || toolId) && onSave({ toolId, note })}
      submitText={target ? "Save Note" : "Submit Request"}
      loading={loading}
      error={error}
    >
      <Grid container spacing={2}>
        {!target && (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormLabel style={{ fontSize: 12 }}>Shop</FormLabel>
              <Select native fullWidth value={shopId}
                onChange={e => { setShopId((e.target as HTMLSelectElement).value); setToolId(""); }}>
                <option value="">All Shops</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormLabel style={{ fontSize: 12 }}>Tool *</FormLabel>
              <Select native fullWidth value={toolId} onChange={e => setToolId((e.target as HTMLSelectElement).value)}>
                <option value="">— select tool —</option>
                {shopTools.map(t => (
                  <option key={t.id} value={t.id} disabled={!t.requestable}>
                    {t.name}{t.shopName ? ` (${t.shopName})` : ""}{!t.requestable ? " — prerequisites unmet" : ""}
                  </option>
                ))}
              </Select>
            </Grid>
            {selectedTool?.prerequisiteNames?.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="textSecondary">
                  Prerequisites: {selectedTool.prerequisiteNames.join(", ")}
                </Typography>
              </Grid>
            )}
          </>
        )}
        {target && (
          <Grid size={{ xs: 12 }}>
            <Typography>
              <strong>{target.toolName}</strong> in <strong>{target.shopName}</strong>
            </Typography>
          </Grid>
        )}
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="Note"
            placeholder="Optional note for the checkout approver"
            value={note}
            onChange={e => setNote(e.target.value)}
            multiline
            rows={2}
            inputProps={{ maxLength: NOTE_LIMIT }}
            helperText={`${note.length}/${NOTE_LIMIT} characters`}
            error={noteTooLong}
          />
        </Grid>
      </Grid>
    </FormModal>
  );
};

interface DeleteModalProps {
  target: ToolCheckoutRequest | null;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  error: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ target, onClose, onDelete, loading, error }) => (
  <FormModal id="delete-tool-checkout-request" isOpen={!!target} title="Delete Checkout Request"
    closeHandler={onClose} onSubmit={onDelete} submitText="Delete" loading={loading} error={error}>
    {target && <Typography>Delete your checkout request for <strong>{target.toolName}</strong>?</Typography>}
  </FormModal>
);

interface Props {
  admin?: boolean;
  showMemberActions?: boolean;
}

const ToolCheckoutRequests: React.FC<Props> = ({ admin = false, showMemberActions = false }) => {
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [editingTarget, setEditingTarget] = React.useState<ToolCheckoutRequest | undefined>();
  const [deleteTarget, setDeleteTarget] = React.useState<ToolCheckoutRequest | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);

  const listFn = admin ? adminListToolCheckoutRequests : listToolCheckoutRequests;
  const { isRequesting, data: requests = [], response, refresh, error: loadError } =
    useReadTransaction(listFn, {}, undefined, admin ? "admin-tool-checkout-requests" : "tool-checkout-requests");
  const { data: availableTools = [] } = useReadTransaction(listAvailableToolsForCheckoutRequest, {}, !showMemberActions, "checkout-request-tools");
  const { data: shops = [] } = useReadTransaction(listShops, {}, !showMemberActions, "checkout-request-shops");

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const selectedRequest = (requests as ToolCheckoutRequest[]).find(r => r.id === selectedId);
  const onSuccess = React.useCallback(() => {
    setRequestOpen(false); setEditingTarget(undefined); setDeleteTarget(null); setSelectedId(undefined); refreshRef.current();
  }, []);

  const { call: createRequest, isRequesting: creating, error: createError } = useWriteTransaction(createToolCheckoutRequest, onSuccess);
  const { call: updateRequest, isRequesting: updating, error: updateError } = useWriteTransaction(updateToolCheckoutRequest, onSuccess);
  const { call: deleteRequest, isRequesting: deleting, error: deleteError } = useWriteTransaction(deleteToolCheckoutRequest, onSuccess);

  const columns: Column<ToolCheckoutRequest>[] = [
    ...(admin ? [{
      id: "memberName", label: "Member", defaultSortDirection: SortDirection.Asc,
      cell: (row: ToolCheckoutRequest) => <div><Typography variant="body2"><strong>{row.memberName}</strong></Typography><Typography variant="caption" color="textSecondary">{row.memberEmail}</Typography></div>,
    } as Column<ToolCheckoutRequest>] : []),
    { id: "toolName", label: "Tool", defaultSortDirection: SortDirection.Asc, cell: row => <div><Typography variant="body2">{row.toolName}</Typography><Typography variant="caption" color="textSecondary">{row.shopName}</Typography></div> },
    { id: "note", label: "Note", cell: row => row.note || "—" },
    { id: "createdAt", label: "Requested", defaultSortDirection: SortDirection.Desc, cell: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—" },
    { id: "status", label: "Status", cell: row => row.checkedOut ? <StatusLabel label="Checked out" color={Status.Success} /> : <Chip size="small" label={row.status || "open"} /> },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h6">{admin ? "Tool Checkout Requests" : "My Checkout Requests"}</Typography>
            <Typography variant="body2" color="textSecondary">
              {admin ? "Open and historical tool checkout requests." : "Request a checkout for tools where you have completed all prerequisites."}
            </Typography>
          </div>
          {showMemberActions && (
            <div style={{ display: "flex", gap: 8 }}>
              {selectedRequest && (
                <>
                  <Button variant="outlined" color="primary" startIcon={<EditIcon />} onClick={() => setEditingTarget(selectedRequest)}>Edit Note</Button>
                  <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={() => setDeleteTarget(selectedRequest)}>Delete</Button>
                </>
              )}
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setRequestOpen(true)}>Request Checkout</Button>
            </div>
          )}
        </Grid>
      </Grid>
      {loadError && <Grid size={{ xs: 12 }}><ErrorMessage error={loadError} /></Grid>}
      <Grid size={{ xs: 12 }}>
        <StatefulTable id={admin ? "admin-tool-checkout-requests-table" : "tool-checkout-requests-table"}
          title={admin ? "Requests" : "Open Requests"} loading={isRequesting}
          data={requests as ToolCheckoutRequest[]} error={loadError} columns={columns}
          rowId={rowId} totalItems={extractTotalItems(response)} selectedIds={selectedId}
          setSelectedIds={showMemberActions ? setSelectedId : undefined} renderSearch={true} />
      </Grid>
      {(requestOpen || editingTarget) && (
        <RequestModal availableTools={availableTools as AvailableTool[]} shops={shops as Shop[]} target={editingTarget}
          onClose={() => { setRequestOpen(false); setEditingTarget(undefined); }}
          onSave={({ toolId, note }) => editingTarget ? updateRequest({ id: editingTarget.id, body: { note } }) : createRequest({ body: { toolId, note } })}
          loading={creating || updating} error={createError || updateError} />
      )}
      <DeleteModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={() => deleteTarget && deleteRequest({ id: deleteTarget.id })} loading={deleting} error={deleteError} />
    </Grid>
  );
};

export default withQueryContext(ToolCheckoutRequests);
