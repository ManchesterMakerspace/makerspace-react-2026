import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import AddIcon from "@mui/icons-material/Add";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import LoadingOverlay from "ui/common/LoadingOverlay";
import StatusLabel from "ui/common/StatusLabel";
import { Status } from "ui/constants";
import { numberAsCurrency } from "ui/utils/numberAsCurrency";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import extractTotalItems from "ui/utils/extractTotalItems";
import { withQueryContext } from "ui/common/Filters/QueryContext";

import { ShopFeeItem } from "app/entities/shopFee";
import {
  listShopFeeItems,
  adminCreateShopFeeItem,
  adminUpdateShopFeeItem,
  adminDeleteShopFeeItem,
} from "api/shopFees";

const rowId = (item: ShopFeeItem) => item.id;

// ── AddFeeItemModal ───────────────────────────────────────────────────────────

interface AddFeeItemModalProps {
  onClose: () => void;
  onSave: (item: { name: string; description: string; amount: string }) => void;
  loading: boolean;
  error: string;
}

const AddFeeItemModal: React.FC<AddFeeItemModalProps> = ({ onClose, onSave, loading, error }) => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");

  return (
    <FormModal
      id="add-fee-item" isOpen={true} title="Add Catalog Item"
      closeHandler={onClose}
      onSubmit={() => { if (!name || !amount) return; onSave({ name, description, amount }); }}
      submitText="Add Item" loading={loading} error={error}
    >
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField fullWidth required label="Item Name"
            placeholder="e.g. Router Bit Replacement, Steel Stock 1ft"
            value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth label="Description"
            placeholder="Optional — shown on the invoice"
            value={description} onChange={e => setDescription(e.target.value)} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth required label="Unit Price ($)" placeholder="0.00"
            type="number" inputProps={{ min: "0.01", step: "0.01" }}
            value={amount} onChange={e => setAmount(e.target.value)} />
        </Grid>
      </Grid>
    </FormModal>
  );
};

// ── DeleteFeeItemModal ────────────────────────────────────────────────────────

interface DeleteFeeItemModalProps {
  target: ShopFeeItem | null;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  error: string;
}

const DeleteFeeItemModal: React.FC<DeleteFeeItemModalProps> = ({ target, onClose, onDelete, loading, error }) => (
  <FormModal id="delete-fee-item" isOpen={!!target} title="Delete Catalog Item"
    closeHandler={onClose} onSubmit={onDelete} submitText="Delete" loading={loading} error={error}>
    {target && (
      <Typography>
        Are you sure you want to remove <strong>{target.name}</strong> from the catalog?
        This only removes it from the lookup list — existing invoices are not affected.
      </Typography>
    )}
  </FormModal>
);

// ── EditFeeItemRow ────────────────────────────────────────────────────────────

interface EditFeeItemRowProps {
  item: ShopFeeItem;
  onSave: (id: string, patch: { name: string; description: string; amount: string }) => void;
  onCancel: () => void;
  saving: boolean;
}

const EditFeeItemRow: React.FC<EditFeeItemRowProps> = ({ item, onSave, onCancel, saving }) => {
  const [name, setName] = React.useState(item.name);
  const [description, setDescription] = React.useState(item.description || "");
  const [amount, setAmount] = React.useState(item.amount);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <TextField size="small" value={name} onChange={e => setName(e.target.value)}
        placeholder="Item name" style={{ flex: 2 }} autoFocus />
      <TextField size="small" value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Description" style={{ flex: 2 }} />
      <TextField size="small" value={amount} onChange={e => setAmount(e.target.value)}
        placeholder="0.00" type="number" inputProps={{ min: "0.01", step: "0.01" }} style={{ flex: 1 }} />
      <Tooltip title="Save changes"><span>
        <IconButton size="small" color="primary" disabled={saving || !name || !amount}
          onClick={() => onSave(item.id, { name, description, amount })}>
          <SaveIcon fontSize="small" />
        </IconButton>
      </span></Tooltip>
      <Tooltip title="Cancel">
        <IconButton size="small" onClick={onCancel}><CancelIcon fontSize="small" /></IconButton>
      </Tooltip>
    </div>
  );
};

// ── FeeCatalog ────────────────────────────────────────────────────────────────

const FeeCatalog: React.FC = () => {
  const [addOpen,      setAddOpen]      = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ShopFeeItem | null>(null);
  const [editingId,    setEditingId]    = React.useState<string | null>(null);
  const [selectedId,   setSelectedId]   = React.useState<string | undefined>(undefined);

  const { isRequesting, data: items = [], response, refresh, error: loadError } =
    useReadTransaction(listShopFeeItems, {}, undefined, "shop-fee-items");

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const onMutateSuccess = React.useCallback(() => {
    setAddOpen(false);
    setDeleteTarget(null);
    setEditingId(null);
    setSelectedId(undefined);
    refreshRef.current();
  }, []);

  const { call: createItem, isRequesting: creating, error: createError } =
    useWriteTransaction(adminCreateShopFeeItem, onMutateSuccess);
  const { call: updateItem, isRequesting: updating, error: updateError } =
    useWriteTransaction(adminUpdateShopFeeItem, onMutateSuccess);
  const { call: deleteItem, isRequesting: deleting, error: deleteError } =
    useWriteTransaction(adminDeleteShopFeeItem, onMutateSuccess);

  const selectedItem = (items as ShopFeeItem[]).find(i => i.id === selectedId);

  const handleSaveEdit = React.useCallback((id: string, patch: { name: string; description: string; amount: string }) => {
    updateItem({ id, body: patch as Partial<ShopFeeItem> });
  }, [updateItem]);

  const handleCancelEdit = React.useCallback(() => {
    setEditingId(null);
    setSelectedId(undefined);
  }, []);

  const handleSelectId = React.useCallback((id: string | undefined) => {
    setEditingId(null); // cancel any in-progress edit when selecting a different row
    setSelectedId(id);
  }, []);

  const columns: Column<ShopFeeItem>[] = [
    {
      id: "item", label: "Item",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: ShopFeeItem) =>
        editingId === row.id ? (
          <EditFeeItemRow item={row} onSave={handleSaveEdit} onCancel={handleCancelEdit} saving={updating} />
        ) : (
          <div>
            <Typography variant="body2"><strong>{row.name}</strong></Typography>
            {row.description && <Typography variant="caption" color="textSecondary">{row.description}</Typography>}
          </div>
        ),
    },
    {
      id: "amount", label: "Unit Price",
      defaultSortDirection: SortDirection.Desc,
      cell: (row: ShopFeeItem) => editingId === row.id ? null : <strong>{numberAsCurrency(row.amount)}</strong>,
    },
    {
      id: "status", label: "Status",
      cell: (row: ShopFeeItem) => editingId === row.id ? null : (
        row.disabled
          ? <StatusLabel label="Disabled" color={Status.Warn} />
          : <StatusLabel label="Active"   color={Status.Success} />
      ),
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h6">Fee Catalog</Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
              Pre-defined items available when sending shop charges to members.
              Prices can be overridden at invoice time.
            </Typography>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedItem && !editingId && (
              <>
                <Button variant="outlined" color="primary" startIcon={<EditIcon />}
                  onClick={() => setEditingId(selectedItem.id)}>
                  Edit
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />}
                  onClick={() => setDeleteTarget(selectedItem)}>
                  Delete
                </Button>
              </>
            )}
            <Button variant="contained" color="primary" startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}>
              Add Item
            </Button>
          </div>
        </Grid>
      </Grid>

      {loadError  && <Grid item xs={12}><ErrorMessage error={loadError}  /></Grid>}
      {updateError && <Grid item xs={12}><ErrorMessage error={updateError} /></Grid>}

      <Grid item xs={12} style={{ position: "relative" }}>
        <StatefulTable
          id="shop-fee-catalog-table" title="Catalog Items"
          loading={isRequesting} data={items as ShopFeeItem[]} error={loadError}
          columns={columns} rowId={rowId} totalItems={extractTotalItems(response)}
          selectedIds={selectedId} setSelectedIds={handleSelectId}
          renderSearch={true}
        />
        {updating && <LoadingOverlay id="fee-catalog-saving" contained />}
      </Grid>

      {addOpen && (
        <AddFeeItemModal
          onClose={() => setAddOpen(false)}
          onSave={(item) => createItem({ body: item as Partial<ShopFeeItem> })}
          loading={creating} error={createError}
        />
      )}

      <DeleteFeeItemModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={() => deleteTarget && deleteItem({ id: deleteTarget.id })}
        loading={deleting} error={deleteError}
      />
    </Grid>
  );
};

export default withQueryContext(FeeCatalog);
