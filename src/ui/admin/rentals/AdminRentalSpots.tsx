import * as React from "react";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

import { RentalSpot, RentalType } from "app/entities/rentalSpot";
import StatefulTable from "ui/common/table/StatefulTable";
import { SortDirection } from "ui/common/table/constants";
import { Column } from "ui/common/table/Table";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import ErrorMessage from "ui/common/ErrorMessage";
import FormModal from "ui/common/FormModal";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import {
  adminListRentalSpots, adminCreateRentalSpot,
  adminUpdateRentalSpot, adminDeleteRentalSpot,
  adminListRentalTypes,
} from "api/rentals";
import { withQueryContext, useQueryContext } from "ui/common/Filters/QueryContext";
import extractTotalItems from "ui/utils/extractTotalItems";

const rowId = (spot: RentalSpot) => spot.id;

const emptySpot = (): Partial<RentalSpot> => ({
  number: "", location: "", description: "",
  rentalTypeId: "", requiresApproval: false,
  active: true, parentNumber: null, notes: null,
});

const warningBoxStyle: React.CSSProperties = {
  padding: "8px", backgroundColor: "#fff3e0",
  borderRadius: "4px", border: "1px solid #ffcc02", marginTop: "8px"
};

const AdminRentalSpots: React.FC = () => {
  const [modalOpen,    setModalOpen]    = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<RentalSpot | null>(null);
  const [editTarget,   setEditTarget]   = React.useState<Partial<RentalSpot>>(emptySpot());
  const [isEditing,    setIsEditing]    = React.useState(false);
  const [selectedId,   setSelectedId]   = React.useState<string>(undefined);
  const { params, changePage } = useQueryContext();

  const { data: rentalTypes = [] } = useReadTransaction(
    adminListRentalTypes, {}, undefined, "admin-rental-types-for-spots"
  );

  const { isRequesting, data: spots = [], response, refresh, error } = useReadTransaction(
    adminListRentalSpots, { ...params }, undefined, "admin-rental-spots"
  );

  const selectedSpot = (spots as RentalSpot[]).find(s => s.id === selectedId);

  const onSaveSuccess = React.useCallback(() => {
    setModalOpen(false); setEditTarget(emptySpot()); setIsEditing(false);
    setSelectedId(undefined); refresh();
  }, [refresh]);

  const onDeleteSuccess = React.useCallback(() => {
    setDeleteTarget(null); setSelectedId(undefined); refresh(); changePage(0);
  }, [refresh, changePage]);

  const { call: createSpot, isRequesting: creating, error: createError } = useWriteTransaction(adminCreateRentalSpot, onSaveSuccess);
  const { call: updateSpot, isRequesting: updating, error: updateError } = useWriteTransaction(adminUpdateRentalSpot, onSaveSuccess);
  const { call: deleteSpot, isRequesting: deleting, error: deleteError } = useWriteTransaction(adminDeleteRentalSpot, onDeleteSuccess);
  const isSaving = creating || updating;

  const openCreate = () => { setEditTarget(emptySpot()); setIsEditing(false); setModalOpen(true); };
  const openEdit   = (spot: RentalSpot) => { setEditTarget({ ...spot }); setIsEditing(true); setModalOpen(true); };
  const setField   = (field: keyof RentalSpot, value: any) => setEditTarget(prev => ({ ...prev, [field]: value }));

  const handleSave = React.useCallback(() => {
    if (isEditing && editTarget.id) {
      updateSpot({ id: editTarget.id, body: editTarget as RentalSpot });
    } else {
      createSpot({ body: editTarget as RentalSpot });
    }
  }, [isEditing, editTarget, createSpot, updateSpot]);

  const columns: Column<RentalSpot>[] = [
    {
      id: "number", label: "Number",
      cell: (row: RentalSpot) => (
        <span>
          {row.number}
          {row.parentNumber && (
            <Chip size="small" label={`sub of ${row.parentNumber}`}
              style={{ marginLeft: "6px", fontSize: "10px" }} />
          )}
        </span>
      ),
      defaultSortDirection: SortDirection.Asc,
    },
    { id: "location",   label: "Location", cell: (row: RentalSpot) => row.location },
    { id: "rentalType", label: "Type",     cell: (row: RentalSpot) => row.rentalTypeDisplayName || "—" },
    {
      id: "billing", label: "Billing Plan",
      cell: (row: RentalSpot) => row.invoiceOptionName
        ? `${row.invoiceOptionName} ($${row.invoiceOptionAmount})`
        : <Typography variant="caption" color="textSecondary">Not set</Typography>,
    },
    {
      id: "approval", label: "Approval",
      cell: (row: RentalSpot) => row.requiresApproval
        ? <StatusLabel label="Required" color={Status.Warn} />
        : <StatusLabel label="Auto"     color={Status.Success} />,
    },
    {
      id: "available", label: "Available",
      cell: (row: RentalSpot) => row.available
        ? <StatusLabel label="Yes" color={Status.Success} />
        : <StatusLabel label="No"  color={Status.Default} />,
    },
    {
      id: "active", label: "Active",
      cell: (row: RentalSpot) => row.active
        ? <StatusLabel label="Active"   color={Status.Success} />
        : <StatusLabel label="Disabled" color={Status.Danger} />,
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Rental Spots</Typography>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedSpot && (
              <>
                <Button variant="outlined" color="primary" startIcon={<EditIcon />}
                  onClick={() => openEdit(selectedSpot)}>
                  Edit
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />}
                  onClick={() => setDeleteTarget(selectedSpot)}>
                  Delete
                </Button>
              </>
            )}
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={openCreate}>
              Add Spot
            </Button>
          </div>
        </Grid>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id="admin-rental-spots-table" title="Rental Spots"
          loading={isRequesting} data={Object.values(spots)} error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId} setSelectedIds={setSelectedId}
          columns={columns} rowId={rowId} renderSearch={true}
        />
      </Grid>

      {modalOpen && (
        <FormModal
          id="rental-spot-form" isOpen={modalOpen}
          title={isEditing ? `Edit Spot — ${editTarget.number}` : "Add Rental Spot"}
          closeHandler={() => { setModalOpen(false); setEditTarget(emptySpot()); }}
          onSubmit={handleSave}
          submitText={isEditing ? "Save Changes" : "Create Spot"}
          loading={isSaving} error={createError || updateError}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth required label="Spot Number"
                placeholder="e.g. Shelf-1a, LR-Tote-1"
                value={editTarget.number || ""}
                onChange={e => setField("number", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth required label="Location"
                placeholder="e.g. Back Shop, Locker Room"
                value={editTarget.location || ""}
                onChange={e => setField("location", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField select fullWidth required label="Rental Type"
                value={editTarget.rentalTypeId || ""}
                onChange={e => setField("rentalTypeId", e.target.value)}
              >
                <MenuItem value="">— Select type —</MenuItem>
                {(rentalTypes as RentalType[]).map((t: RentalType) => (
                  <MenuItem key={t.id} value={t.id}>{t.displayName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Parent Spot Number"
                placeholder="Leave blank if not a sub-spot"
                value={editTarget.parentNumber || ""}
                onChange={e => setField("parentNumber", e.target.value || null)}
                helperText="e.g. Shelf-1 for Shelf-1a or Shelf-1b"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Description"
                placeholder="e.g. Full shelf, bottom row"
                value={editTarget.description || ""}
                onChange={e => setField("description", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Notes"
                value={editTarget.notes || ""}
                onChange={e => setField("notes", e.target.value || null)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControlLabel
                control={<Switch checked={!!editTarget.requiresApproval} color="primary"
                  onChange={e => setField("requiresApproval", e.target.checked)} />}
                label="Requires Admin Approval"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControlLabel
                control={<Switch checked={editTarget.active !== false} color="primary"
                  onChange={e => setField("active", e.target.checked)} />}
                label="Active (visible to members)"
              />
            </Grid>
          </Grid>
        </FormModal>
      )}

      <FormModal
        id="delete-rental-spot" isOpen={!!deleteTarget} title="Delete Rental Spot"
        closeHandler={() => setDeleteTarget(null)}
        onSubmit={() => deleteTarget && deleteSpot({ id: deleteTarget.id })}
        submitText="Delete" loading={deleting} error={deleteError}
      >
        {deleteTarget && (
          <>
            <Typography gutterBottom>
              Are you sure you want to delete spot <strong>{deleteTarget.number}</strong>?
            </Typography>
            <Typography variant="body2" style={warningBoxStyle}>
              This only removes the spot from the catalog. Existing rentals are not affected.
            </Typography>
          </>
        )}
      </FormModal>
    </Grid>
  );
};

export default withQueryContext(AdminRentalSpots);
