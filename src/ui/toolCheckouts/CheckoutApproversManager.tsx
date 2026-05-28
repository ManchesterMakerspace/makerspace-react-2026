import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormLabel from "@mui/material/FormLabel";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { withQueryContext } from "ui/common/Filters/QueryContext";
import MemberSearchInput from "ui/common/MemberSearchInput";
import { SelectOption } from "ui/common/AsyncSelect";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import extractTotalItems from "ui/utils/extractTotalItems";
import { CheckoutApprover, Shop } from "app/entities/toolCheckout";
import {
  listCheckoutApprovers,
  adminCreateCheckoutApprover,
  adminUpdateCheckoutApprover,
  adminDeleteCheckoutApprover,
  listShops,
} from "api/toolCheckouts";

const rowId = (a: CheckoutApprover) => a.id;

// ── ApproverModal (Add + Edit) ────────────────────────────────────────────────

interface ApproverModalProps {
  shops: Shop[];
  existing: CheckoutApprover | null; // null = adding new
  onClose: () => void;
  onSave: (memberId: string, shopIds: string[], existingId?: string) => void;
  loading: boolean;
  error: string;
}

const ApproverModal: React.FC<ApproverModalProps> = ({ shops, existing, onClose, onSave, loading, error }) => {
  const [selectedMember, setSelectedMember] = React.useState<SelectOption | null>(
    existing ? { value: existing.memberId, label: existing.memberName } : null
  );
  const [shopIds, setShopIds] = React.useState<string[]>(existing ? existing.shopIds : []);

  // When member selection changes in Add mode, check if they're already an approver
  // (handled by parent via existing prop — if user picks existing member, parent sets existing)
  const toggleShop = (id: string) => {
    setShopIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const isEditing = !!existing;
  const title = isEditing ? `Edit Approver — ${existing.memberName}` : "Add Checkout Approver";
  const submitText = isEditing ? "Save Changes" : "Add Approver";

  const handleSubmit = () => {
    if (!shopIds.length) return;
    if (isEditing) {
      onSave(existing.memberId, shopIds, existing.id);
    } else if (selectedMember) {
      onSave(selectedMember.value, shopIds);
    }
  };

  return (
    <FormModal
      id="approver-modal" isOpen={true} title={title}
      closeHandler={onClose} onSubmit={handleSubmit}
      submitText={submitText} loading={loading} error={error}
    >
      <Grid container spacing={2}>
        {!isEditing && (
          <Grid item xs={12}>
            <FormLabel style={{ marginBottom: 6, display: "block" }}>Member *</FormLabel>
            <MemberSearchInput
              name="approver-member-search"
              placeholder="Search by name or email"
              onChange={(opt: SelectOption) => setSelectedMember(opt || null)}
              initialSelection={selectedMember}
            />
          </Grid>
        )}
        <Grid item xs={12}>
          <FormLabel style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
            Shops this member can approve checkouts for *
          </FormLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {shops.map(s => (
              <Chip
                key={s.id}
                label={s.name}
                size="small"
                onClick={() => toggleShop(s.id)}
                color={shopIds.includes(s.id) ? "primary" : "default"}
                variant={shopIds.includes(s.id) ? "default" : "outlined"}
                clickable
              />
            ))}
          </div>
          {shopIds.length === 0 && (
            <Typography variant="caption" color="error">Select at least one shop</Typography>
          )}
        </Grid>
      </Grid>
    </FormModal>
  );
};

// ── DeleteApproverModal ───────────────────────────────────────────────────────

interface DeleteApproverModalProps {
  target: CheckoutApprover | null;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  error: string;
}

const DeleteApproverModal: React.FC<DeleteApproverModalProps> = ({ target, onClose, onDelete, loading, error }) => (
  <FormModal id="delete-approver" isOpen={!!target} title="Remove Approver"
    closeHandler={onClose} onSubmit={onDelete} submitText="Remove" loading={loading} error={error}>
    {target && (
      <Typography>
        Remove <strong>{target.memberName}</strong> as a checkout approver?
        They will no longer be able to sign off checkouts via the portal or Slack.
      </Typography>
    )}
  </FormModal>
);

// ── CheckoutApproversManager ──────────────────────────────────────────────────

const CheckoutApproversManager: React.FC = () => {
  const [modalMode, setModalMode] = React.useState<"add" | "edit" | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = React.useState<CheckoutApprover | null>(null);

  const { isRequesting, data: approvers = [], response, refresh, error: loadError } =
    useReadTransaction(listCheckoutApprovers, {}, undefined, "checkout-approvers");
  const { data: shops = [] } = useReadTransaction(listShops, {}, undefined, "shops-approvers");

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onSuccess = React.useCallback(() => {
    setModalMode(null);
    setDeleteTarget(null);
    setSelectedId(undefined);
    refreshRef.current();
  }, []);

  const { call: createApprover, isRequesting: creating, error: createError } =
    useWriteTransaction(adminCreateCheckoutApprover, onSuccess);
  const { call: updateApprover, isRequesting: updating, error: updateError } =
    useWriteTransaction(adminUpdateCheckoutApprover, onSuccess);
  const { call: deleteApprover, isRequesting: deleting, error: deleteError } =
    useWriteTransaction(adminDeleteCheckoutApprover, onSuccess);

  const selectedApprover = approvers.find((a: CheckoutApprover) => a.id === selectedId) || null;

  const handleSave = (memberId: string, shopIds: string[], existingId?: string) => {
    if (existingId) {
      updateApprover({ id: existingId, body: { shopIds } });
    } else {
      createApprover({ body: { memberId, shopIds } });
    }
  };

  const columns: Column<CheckoutApprover>[] = [
    {
      id: "memberName",
      label: "Member",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: CheckoutApprover) => (
        <div>
          <Typography variant="body2"><strong>{row.memberName}</strong></Typography>
          <Typography variant="caption" color="textSecondary">{row.memberEmail}</Typography>
        </div>
      ),
    },
    {
      id: "shopNames",
      label: "Authorized Shops",
      cell: (row: CheckoutApprover) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {row.shopNames?.map(name => (
            <Chip key={name} label={name} size="small" variant="outlined" />
          ))}
        </div>
      ),
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Grid container justify="space-between" alignItems="center">
          <div>
            <Typography variant="h6">Checkout Approvers</Typography>
            <Typography variant="body2" color="textSecondary">
              Members who can sign off tool checkouts via the portal or Slack slash command,
              scoped to specific shops.
            </Typography>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedId && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setModalMode("edit")}
                >
                  Edit Shops
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteTarget(selectedApprover)}
                >
                  Remove Approver
                </Button>
              </>
            )}
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setModalMode("add")}>
              Add Approver
            </Button>
          </div>
        </Grid>
      </Grid>

      {loadError && <Grid item xs={12}><ErrorMessage error={loadError} /></Grid>}

      <Grid item xs={12}>
        <StatefulTable
          id="approvers-table"
          title="Checkout Approvers"
          loading={isRequesting}
          data={approvers as CheckoutApprover[]}
          error={loadError}
          columns={columns}
          rowId={rowId}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId}
          setSelectedIds={setSelectedId}
          renderSearch={false}
        />
      </Grid>

      {modalMode && (
        <ApproverModal
          shops={shops as Shop[]}
          existing={modalMode === "edit" ? selectedApprover : null}
          onClose={() => setModalMode(null)}
          onSave={handleSave}
          loading={creating || updating}
          error={createError || updateError}
        />
      )}

      <DeleteApproverModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={() => deleteTarget && deleteApprover({ id: deleteTarget.id })}
        loading={deleting}
        error={deleteError}
      />
    </Grid>
  );
};

export default withQueryContext(CheckoutApproversManager);
