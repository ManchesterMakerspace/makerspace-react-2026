// @ts-nocheck
import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
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
  listManagedShops, listTools, adminCreateShop, adminUpdateShop, adminDeleteShop,
} from "api/toolCheckouts";
import ReservationSettingsFields, { ReservationSettingsValue } from "./ReservationSettingsFields";
import ShopColorField from "./ShopColorField";
import { useCapabilities } from "app/permissions";

const rowId = (s: Shop) => s.id;
const normalizedName = (value: string) => value.trim().toLowerCase();

// ── AddShopModal ──────────────────────────────────────────────────────────────

interface AddShopModalProps {
  shops: Shop[];
  onClose: () => void;
  onSave: (body: Partial<Shop>) => void;
  loading: boolean;
  error: string;
}

const AddShopModal: React.FC<AddShopModalProps> = ({ shops, onClose, onSave, loading, error }) => {
  const [name, setName] = React.useState("");
  const [slackChannel, setSlackChannel] = React.useState("");
  const [colorId, setColorId] = React.useState("1");
  const [localError, setLocalError] = React.useState("");
  const [reservation, setReservation] = React.useState<ReservationSettingsValue>({
    reservable: false, maxConcurrentReservations: 1, reservationHorizonDays: 7,
    maxReservationDurationHours: 8, reservationRequiresApproval: false,
    reservationPrerequisiteToolIds: []
  });

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (shops.some(s => normalizedName(s.name) === normalizedName(trimmedName))) {
      setLocalError("A shop with this name already exists.");
      return;
    }

    setLocalError("");
    onSave({ name: trimmedName, slackChannel, colorId, ...reservation });
  };

  return (
    <FormModal id="add-shop" isOpen={true} title="Add Shop"
      closeHandler={onClose}
      onSubmit={submit}
      submitText="Add Shop" loading={loading} error={localError || error}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth required label="Shop Name" placeholder="e.g. Woodshop"
            value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ShopColorField value={colorId} onChange={setColorId} />
        </Grid>
        <ReservationSettingsFields value={reservation} onChange={setReservation} />
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Slack Channel" placeholder="e.g. shop-woodworking"
            value={slackChannel} onChange={e => setSlackChannel(e.target.value)}
            helperText="Used to route /checkout slash commands to this shop" />
        </Grid>
      </Grid>
    </FormModal>
  );
};

// ── EditShopRow ───────────────────────────────────────────────────────────────

interface EditShopRowProps {
  shop: Shop;
  tools: Tool[];
  onSave: (id: string, body: Partial<Shop>) => void;
  onCancel: () => void;
  saving: boolean;
}

const EditShopRow: React.FC<EditShopRowProps> = ({ shop, tools, onSave, onCancel, saving }) => {
  const [name, setName] = React.useState(shop.name);
  const [slackChannel, setSlackChannel] = React.useState(shop.slackChannel || "");
  const [colorId, setColorId] = React.useState(shop.colorId || "1");
  const [reservation, setReservation] = React.useState<ReservationSettingsValue>(shop);
  return (
    <Grid container spacing={1} alignItems="center">
      <Grid size={{ xs: 12, sm: 4 }}>
      <TextField size="small" value={name} onChange={e => setName(e.target.value)}
        placeholder="Shop name" fullWidth autoFocus />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
      <TextField size="small" value={slackChannel} onChange={e => setSlackChannel(e.target.value)}
        placeholder="slack-channel" fullWidth />
      </Grid>
      <ReservationSettingsFields value={reservation} onChange={setReservation} tools={tools} />
      <Grid size={{ xs: 12 }}>
        <ShopColorField value={colorId} onChange={setColorId} />
      </Grid>
      <Grid size={{ xs: 12 }}>
      <Tooltip title="Save"><span>
        <IconButton size="small" color="primary" disabled={saving || !name}
          onClick={() => onSave(shop.id, { name, slackChannel, colorId, ...reservation })}>
          <SaveIcon fontSize="small" />
        </IconButton>
      </span></Tooltip>
      <Tooltip title="Cancel">
        <IconButton size="small" onClick={onCancel}><CancelIcon fontSize="small" /></IconButton>
      </Tooltip>
      </Grid>
    </Grid>
  );
};

// ── DeleteShopModal ───────────────────────────────────────────────────────────

interface DeleteShopModalProps {
  target: Shop | null;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  error: string;
}

const DeleteShopModal: React.FC<DeleteShopModalProps> = ({ target, onClose, onDelete, loading, error }) => (
  <FormModal id="delete-shop" isOpen={!!target} title="Delete Shop"
    closeHandler={onClose} onSubmit={onDelete} submitText="Delete" loading={loading} error={error}>
    {target && (
      <Typography>
        Delete <strong>{target.name}</strong>? This will also delete all tools in this shop.
        Existing checkout records will be preserved.
      </Typography>
    )}
  </FormModal>
);

// ── ShopManager ───────────────────────────────────────────────────────────────

const ShopManager: React.FC = () => {
  const [addOpen,      setAddOpen]      = React.useState(false);
  const [editingId,    setEditingId]    = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Shop | null>(null);
  const [selectedId,   setSelectedId]   = React.useState<string | undefined>(undefined);

  const { isRequesting, data: shops = [], response, refresh, error: loadError } =
    useReadTransaction(listManagedShops, {}, undefined, "shops-list");
  const { data: tools = [] } = useReadTransaction(listTools, {}, undefined, "shops-tools-list");
  const { canManageCheckoutApprovers } = useCapabilities();

  const refreshRef = React.useRef(refresh);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const selectedShop = (shops as Shop[]).find(s => s.id === selectedId);

  const onSuccess = React.useCallback(() => {
    setAddOpen(false); setEditingId(null); setDeleteTarget(null);
    setSelectedId(undefined); refreshRef.current();
  }, []);

  const { call: createShop, isRequesting: creating, error: createError } = useWriteTransaction(adminCreateShop, onSuccess);
  const { call: updateShop, isRequesting: updating, error: updateError } = useWriteTransaction(adminUpdateShop, onSuccess);
  const { call: deleteShop, isRequesting: deleting, error: deleteError } = useWriteTransaction(adminDeleteShop, onSuccess);

  const handleSave = React.useCallback((id: string, body: Partial<Shop>) => {
    updateShop({ id, body });
  }, [updateShop]);

  const handleCancel = React.useCallback(() => {
    setEditingId(null);
    setSelectedId(undefined);
  }, []);

  const handleSelectId = React.useCallback((id: string | undefined) => {
    setEditingId(null);
    setSelectedId(id);
  }, []);

  const columns: Column<Shop>[] = [
    {
      id: "name", label: "Shop",
      defaultSortDirection: SortDirection.Asc,
      cell: (row: Shop) => editingId === row.id
        ? <EditShopRow shop={row} tools={(tools as Tool[]).filter(tool => tool.shopId === row.id)}
            onSave={handleSave} onCancel={handleCancel} saving={updating} />
        : <strong>{row.name}</strong>,
    },
    {
      id: "slackChannel", label: "Slack Channel",
      cell: (row: Shop) => editingId === row.id ? null : (
        <span style={{ color: row.slackChannel ? "inherit" : "#aaa" }}>
          {row.slackChannel ? `#${row.slackChannel}` : "Not configured"}
        </span>
      ),
    },
    {
      id: "colorId", label: "Color",
      cell: (row: Shop) => editingId === row.id ? null : (
        <span>{row.colorId ? `Google color ${row.colorId}` : "Not selected"}</span>
      ),
    },
    {
      id: "reservable", label: "Reservations",
      cell: (row: Shop) => editingId === row.id ? null : (
        <span>{row.reservable ? `${row.maxConcurrentReservations} concurrent, ${row.reservationHorizonDays} days` : "Not reservable"}</span>
      ),
    },
    {
      id: "toolCount", label: "Tools",
      cell: (row: Shop) => editingId === row.id ? null : <span>{(row as any).toolCount ?? 0}</span>,
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h6">Shops</Typography>
            <Typography variant="body2" color="textSecondary">
              Manage shop locations. Each shop can be linked to a Slack channel for slash command checkout sign-offs.
            </Typography>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedShop && !editingId && (
              <>
                <Button variant="outlined" color="primary" startIcon={<EditIcon />}
                  onClick={() => setEditingId(selectedShop.id)}>
                  Edit
                </Button>
                {canManageCheckoutApprovers && <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />}
                  onClick={() => setDeleteTarget(selectedShop)}>
                  Delete
                </Button>}
              </>
            )}
            {canManageCheckoutApprovers && <Button variant="contained" color="primary" startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}>
              Add Shop
            </Button>}
          </div>
        </Grid>
      </Grid>

      {(loadError || updateError) && <Grid size={{ xs: 12 }}><ErrorMessage error={loadError || updateError} /></Grid>}

      <Grid size={{ xs: 12 }} style={{ position: "relative" }}>
        <StatefulTable
          id="shops-table" title="Shops" loading={isRequesting}
          data={shops as Shop[]} error={loadError} columns={columns}
          rowId={rowId} totalItems={extractTotalItems(response)}
          selectedIds={selectedId} setSelectedIds={handleSelectId}
          renderSearch={false}
        />
        {updating && <LoadingOverlay id="shop-saving" contained />}
      </Grid>

      {addOpen && (
        <AddShopModal
          shops={shops as Shop[]}
          onClose={() => setAddOpen(false)}
          onSave={(body) => createShop({ body })}
          loading={creating} error={createError}
        />
      )}

      <DeleteShopModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={() => deleteTarget && deleteShop({ id: deleteTarget.id })}
        loading={deleting} error={deleteError}
      />
    </Grid>
  );
};

export default withQueryContext(ShopManager);
