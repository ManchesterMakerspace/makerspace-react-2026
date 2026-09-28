// @ts-nocheck
import ToolAvailability from "ui/common/ToolAvailability";
import * as React from "react";
import { listToolGroups } from 'api/toolCheckouts';
import GroupApproval from './GroupApproval';
import { useCheckoutCatalog } from './CheckoutCatalog';
import { requestCatalog } from './requestCatalog';
import { defaultItemsPerPage } from 'ui/constants';
import { GroupDetails } from './ToolGroupList';
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import RequestorAnnotationTooltip from "./RequestorAnnotationTooltip";
import Alert from "@mui/material/Alert";
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

export const RequestModal: React.FC<RequestModalProps> = ({ target, onClose, onSave, loading, error }) => {
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
            <ToolAvailability outOfService={target.outOfService} />
            {target.targetType === 'group' && <><Chip label="Group" size="small" /><GroupDetails group={target} /></>}
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
  const { params, setParam } = useQueryContext();
  const shopId = canManage ? undefined : params.shopId || undefined;
  const { data: shops = [] } = useCheckoutCatalog('shops', canManage);
  const [groups, setGroups] = React.useState([]);
  const [groupRequest, setGroupRequest] = React.useState(null);
  const [groupLoading, setGroupLoading] = React.useState(true);
  const [groupError, setGroupError] = React.useState('');
  const groupLoad = React.useRef(0);
  const refreshGroups = React.useCallback(() => {
    const generation = ++groupLoad.current;
    setGroups([]);
    setGroupLoading(true);
    setGroupError('');
    listToolGroups(shopId).then(result => {
      if (generation !== groupLoad.current) return;
      if (result.error) throw new Error('Unable to load tool groups.');
      setGroups(result.data || []);
    }).catch(() => {
      if (generation === groupLoad.current) setGroupError('Unable to load tool groups. Retry to load the complete catalog.');
    }).finally(() => {
      if (generation === groupLoad.current) setGroupLoading(false);
    });
  }, [shopId]);
  React.useEffect(() => {
    refreshGroups();
    return () => { ++groupLoad.current; };
  }, [refreshGroups]);
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
    { shopId },
    canManage,
    `available-tool-checkout-requests-catalog-${shopId || 'all'}`
  );

  const refreshRequestsRef = React.useRef(requestRead.refresh);
  const refreshAvailableRef = React.useRef(availableRead.refresh);
  React.useEffect(() => { refreshRequestsRef.current = requestRead.refresh; }, [requestRead.refresh]);
  React.useEffect(() => { refreshAvailableRef.current = availableRead.refresh; }, [availableRead.refresh]);

  const requests = (requestRead.data || []) as ToolCheckoutRequest[];
  const catalog = requestCatalog(availableRead.data || [], groups, params, defaultItemsPerPage);
  const availableTools = groupLoading || groupError ? [] : catalog.rows;
  const canRequestTool = React.useCallback((tool: Tool) =>
    !!tool.requestable && !tool.requestPending && !tool.unmetPrerequisiteNames?.length,
  []);
  const selectedRequest = requests.find(r => r.id === selectedRequestId);
  const selectedTool = availableTools.find(t => t.id === selectedToolId);

  const onSuccess = React.useCallback(() => {
    setRequestTarget(null);
    setEditTarget(null);
    setSelectedRequestId(undefined);
    setSelectedToolId(undefined);
    refreshRequestsRef.current();
    refreshAvailableRef.current();
    refreshGroups();
  }, [refreshGroups]);

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
          <Typography variant="body2"><strong>{row.targetName || row.toolName}</strong> {row.targetType === 'group' && <Chip label="Group" size="small" />} <ToolAvailability outOfService={row.outOfService} /></Typography>
          <Typography variant="caption" color="textSecondary">{row.shopName}</Typography>
          {!canManage && <RequestorAnnotationTooltip annotation={row.requestorAnnotation} />}
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
          <Typography variant="body2"><strong>{row.name}</strong> {row.targetType === 'group' && <Chip label="Group" size="small" />} <ToolAvailability outOfService={row.outOfService} /></Typography>
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
      cell: row => row.requestPending
        ? <Chip size="small" color="success" label="Request Pending" />
        : row.unmetPrerequisiteNames?.length || !row.requestable
          ? <Chip size="small" label="Missing Prereq" />
          : <Chip size="small" color="primary" label="Send Request" clickable onClick={() => setRequestTarget(row)} />,
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
                onClick={() => selectedRequest.toolGroupId ? setGroupRequest(selectedRequest) : approveRequest({ body: { memberId: selectedRequest.memberId, toolId: selectedRequest.toolId } })}>
                Check Out Member
              </Button>
            )}
          </div>
        </Grid>
      </Grid>

      {groupError && <Grid size={{ xs: 12 }}>
        <Alert severity="error" action={<Button color="inherit" onClick={refreshGroups}>Retry tool groups</Button>}>
          {groupError}
        </Alert>
      </Grid>}

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
              <TextField select label="Shop" value={shopId || ''} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                sx={{ minWidth: 160, maxWidth: '100%' }}
                onChange={event => { setParam('shopId', event.target.value); setSelectedToolId(undefined); setRequestTarget(null); }}>
                <option value="">All shops</option>
                {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
              </TextField>
              {selectedTool && canRequestTool(selectedTool) && (
                <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setRequestTarget(selectedTool)}>
                  Request Checkout
                </Button>
              )}
            </Grid>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <StatefulTable id="available-tools-table" title="Available Tools"
              loading={availableRead.isRequesting || groupLoading} data={availableTools}
              error={availableRead.error} columns={toolColumns} rowId={toolRowId}
              totalItems={groupLoading || groupError ? 0 : catalog.total}
              selectedIds={selectedToolId} setSelectedIds={setSelectedToolId} renderSearch={true}
              isRowSelectable={canRequestTool} />
          </Grid>
        </>
      )}

      <RequestModal target={requestTarget} onClose={() => setRequestTarget(null)}
        onSave={note => requestTarget && createRequest({ body: { ...(requestTarget.targetType === 'group' ? { toolGroupId: requestTarget.id } : { toolId: requestTarget.id }), note } })}
        loading={creating} error={createError} />
      <EditNoteModal target={editTarget} onClose={() => setEditTarget(null)}
        onSave={note => editTarget && updateRequest({ id: editTarget.id, body: { note } })}
        loading={updating} error={updateError} />
      {groupRequest && groups.find(group => group.id === groupRequest.toolGroupId) && <GroupApproval
        group={groups.find(group => group.id === groupRequest.toolGroupId)} memberId={groupRequest.memberId} requestId={groupRequest.id}
        onClose={() => setGroupRequest(null)} onSaved={() => { setGroupRequest(null); onSuccess(); }} />}
    </Grid>
  );
};

export default withQueryContext(ToolCheckoutRequestsManager, {
  orderBy: "requestDate",
  order: SortDirection.Desc,
});
