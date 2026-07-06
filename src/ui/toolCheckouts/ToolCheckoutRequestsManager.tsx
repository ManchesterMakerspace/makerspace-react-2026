// @ts-nocheck
import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { useQueryContext, withQueryContext } from "ui/common/Filters/QueryContext";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import extractTotalItems from "ui/utils/extractTotalItems";
import { Tool, ToolCheckoutRequest } from "app/entities/toolCheckout";
import {
  listAvailableTools,
  listToolCheckoutRequests,
  listMyToolCheckoutRequests,
  createToolCheckoutRequest,
  updateToolCheckoutRequest,
  deleteToolCheckoutRequest,
  adminCreateToolCheckout,
} from "api/toolCheckouts";

const requestRowId = (r: ToolCheckoutRequest) => r.id;
const toolRowId = (t: Tool) => t.id;

const memberName = (request: ToolCheckoutRequest) =>
  request.memberSlackUrl
    ? <a href={request.memberSlackUrl}>{request.memberName}</a>
    : <span>{request.memberName}</span>;

interface RequestModalProps {
  target: Tool | null;
  onClose: () => void;
  onSave: (note: string) => void;
  loading: boolean;
  error: string;
}

const RequestModal: React.FC<RequestModalProps> = ({ target, onClose, onSave, loading, error }) => {
  const [note, setNote] = React.useState("");
  React.useEffect(() => { setNote(""); }, [target?.id]);

  return (
    <FormModal id="request-tool-checkout" isOpen={!!target} title="Request Tool Checkout"
      closeHandler={onClose} onSubmit={() => onSave(note)}
      submitText="Submit Request" loading={loading} error={error}>
      {target && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Typography><strong>{target.name}</strong> in <strong>{target.shopName}</strong></Typography>
            {target.prerequisiteNames?.length > 0 && (
              <Typography variant="caption" color="textSecondary">
                Prerequisites: {target.prerequisiteNames.join(", ")}
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Note" inputProps={{ maxLength: 128 }}
              helperText={`${note.length}/128`} value={note}
              onChange={e => setNote(e.target.value)} multiline rows={2} autoFocus />
          </Grid>
        </Grid>
      )}
    </FormModal>
  );
};

interface EditNoteModalProps {
  target: ToolCheckoutRequest | null;
  onClose: () => void;
  onSave: (note: string) => void;
  loading: boolean;
  error: string;
}

const EditNoteModal: React.FC<EditNoteModalProps> = ({ target, onClose, onSave, loading, error }) => {
  const [note, setNote] = React.useState("");
  React.useEffect(() => { setNote(target?.note || ""); }, [target?.id]);

  return (
    <FormModal id="edit-tool-checkout-request" isOpen={!!target} title="Edit Request Note"
      closeHandler={onClose} onSubmit={() => onSave(note)}
      submitText="Save Note" loading={loading} error={error}>
      <TextField fullWidth label="Note" inputProps={{ maxLength: 128 }}
        helperText={`${note.length}/128`} value={note}
        onChange={e => setNote(e.target.value)} multiline rows={2} autoFocus />
    </FormModal>
  );
};

interface Props {
  canManage: boolean;
}

const ToolCheckoutRequestsManager: React.FC<Props> = ({ canManage }) => {
  const { params } = useQueryContext();
  const [requestTarget, setRequestTarget] = React.useState<Tool | null>(null);
  const [editTarget, setEditTarget] = React.useState<ToolCheckoutRequest | null>(null);
  const [selectedRequestId, setSelectedRequestId] = React.useState<string | undefined>(undefined);
  const [selectedToolId, setSelectedToolId] = React.useState<string | undefined>(undefined);

  const requestRead = useReadTransaction(
    canManage ? listToolCheckoutRequests : listMyToolCheckoutRequests,
    { ...params },
    undefined,
    canManage ? `admin-tool-checkout-requests-${JSON.stringify(params)}` : `my-tool-checkout-requests-${JSON.stringify(params)}`
  );
  const availableRead = useReadTransaction(
    listAvailableTools,
    { ...params },
    canManage,
    `available-tool-checkout-requests-${JSON.stringify(params)}`
  );

  const refreshRequestsRef = React.useRef(requestRead.refresh);
  const refreshAvailableRef = React.useRef(availableRead.refresh);
  React.useEffect(() => { refreshRequestsRef.current = requestRead.refresh; }, [requestRead.refresh]);
  React.useEffect(() => { refreshAvailableRef.current = availableRead.refresh; }, [availableRead.refresh]);

  const requests = (requestRead.data || []) as ToolCheckoutRequest[];
  const availableTools = (availableRead.data || []) as Tool[];
  const selectedRequest = requests.find(r => r.id === selectedRequestId);
  const selectedTool = availableTools.find(t => t.id === selectedToolId);

  const onSuccess = React.useCallback(() => {
    setRequestTarget(null);
    setEditTarget(null);
    setSelectedRequestId(undefined);
    setSelectedToolId(undefined);
    refreshRequestsRef.current();
    refreshAvailableRef.current();
  }, []);

  const { call: createRequest, isRequesting: creating, error: createError } =
    useWriteTransaction(createToolCheckoutRequest, onSuccess);
  const { call: updateRequest, isRequesting: updating, error: updateError } =
    useWriteTransaction(updateToolCheckoutRequest, onSuccess);
  const { call: deleteRequest, isRequesting: deleting, error: deleteError } =
    useWriteTransaction(deleteToolCheckoutRequest, onSuccess);
  const { call: approveRequest, isRequesting: approving, error: approveError } =
    useWriteTransaction(adminCreateToolCheckout, onSuccess);

  const requestColumns: Column<ToolCheckoutRequest>[] = [
    {
      id: "toolName", label: "Tool", defaultSortDirection: SortDirection.Asc,
      cell: row => (
        <div>
          <Typography variant="body2"><strong>{row.toolName}</strong></Typography>
          <Typography variant="caption" color="textSecondary">{row.shopName}</Typography>
        </div>
      ),
    },
    {
      id: "memberName", label: "Member",
      cell: row => canManage ? (
        <div>
          <Typography variant="body2">{memberName(row)}</Typography>
          <Typography variant="caption" color="textSecondary">{row.memberEmail}</Typography>
        </div>
      ) : memberName(row),
    },
    { id: "note", label: "Note", cell: row => <span>{row.note || ""}</span> },
    {
      id: "requestDate", label: "Requested", defaultSortDirection: SortDirection.Desc,
      cell: row => <span>{new Date(row.requestDate).toLocaleDateString()}</span>,
    },
  ];

  const toolColumns: Column<Tool>[] = [
    {
      id: "name", label: "Tool", defaultSortDirection: SortDirection.Asc,
      cell: row => (
        <div>
          <Typography variant="body2"><strong>{row.name}</strong></Typography>
          <Typography variant="caption" color="textSecondary">{row.shopName}</Typography>
        </div>
      ),
    },
    {
      id: "prerequisites", label: "Prerequisites",
      cell: row => row.unmetPrerequisiteNames?.length ? (
        <div>
          {row.unmetPrerequisiteNames.map(name => <Chip key={name} size="small" label={name} style={{ marginRight: 4 }} />)}
        </div>
      ) : <span>Met</span>,
    },
    {
      id: "requestable", label: "Status",
      cell: row => row.requestable ? <Chip size="small" color="primary" label="Requestable" /> : <Chip size="small" label="Prerequisites needed" />,
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h6">{canManage ? "Open Checkout Requests" : "My Checkout Requests"}</Typography>
            <Typography variant="body2" color="textSecondary">
              {canManage ? "Open requests for tools you can approve." : "Request checkout on tools after prerequisites are complete."}
            </Typography>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!canManage && selectedRequest && (
              <>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditTarget(selectedRequest)}>Edit Note</Button>
                <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={() => deleteRequest({ id: selectedRequest.id })}>
                  Delete
                </Button>
              </>
            )}
            {canManage && selectedRequest && (
              <Button variant="contained" color="primary" startIcon={<CheckIcon />}
                onClick={() => approveRequest({ body: { memberId: selectedRequest.memberId, toolId: selectedRequest.toolId } })}>
                Check Out Member
              </Button>
            )}
          </div>
        </Grid>
      </Grid>

      {(requestRead.error || createError || updateError || deleteError || approveError) && (
        <Grid size={{ xs: 12 }}><ErrorMessage error={requestRead.error || createError || updateError || deleteError || approveError} /></Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <StatefulTable id="tool-checkout-requests-table" title="Open Requests"
          loading={requestRead.isRequesting || deleting || approving}
          data={requests} error={requestRead.error} columns={requestColumns}
          rowId={requestRowId} totalItems={extractTotalItems(requestRead.response)}
          selectedIds={selectedRequestId} setSelectedIds={setSelectedRequestId} renderSearch={true} />
      </Grid>

      {!canManage && (
        <>
          <Grid size={{ xs: 12 }}>
            <Grid container justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Available Tools</Typography>
              {selectedTool?.requestable && (
                <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setRequestTarget(selectedTool)}>
                  Request Checkout
                </Button>
              )}
            </Grid>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <StatefulTable id="available-tools-table" title="Available Tools"
              loading={availableRead.isRequesting} data={availableTools}
              error={availableRead.error} columns={toolColumns} rowId={toolRowId}
              totalItems={extractTotalItems(availableRead.response)}
              selectedIds={selectedToolId} setSelectedIds={setSelectedToolId} renderSearch={true} />
          </Grid>
        </>
      )}

      <RequestModal target={requestTarget} onClose={() => setRequestTarget(null)}
        onSave={note => requestTarget && createRequest({ body: { toolId: requestTarget.id, note } })}
        loading={creating} error={createError} />
      <EditNoteModal target={editTarget} onClose={() => setEditTarget(null)}
        onSave={note => editTarget && updateRequest({ id: editTarget.id, body: { note } })}
        loading={updating} error={updateError} />
    </Grid>
  );
};

export default withQueryContext(ToolCheckoutRequestsManager, {
  orderBy: "requestDate",
  order: SortDirection.Desc,
});
