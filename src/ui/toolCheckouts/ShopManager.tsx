// @ts-nocheck
import PublicCatalogQrCodeModal from "ui/common/PublicCatalogQrCodeModal";
import QrCodeIcon from "@mui/icons-material/QrCode";
import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import LoadingOverlay from "ui/common/LoadingOverlay";
import StatefulTable from "ui/common/table/StatefulTable";
import { Column } from "ui/common/table/Table";
import { SortDirection } from "ui/common/table/constants";
import { withQueryContext } from "ui/common/Filters/QueryContext";
import { useCheckoutCatalog } from "./CheckoutCatalog";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { Shop, Tool } from "app/entities/toolCheckout";
import {
  adminCreateShop, adminUpdateShop, adminDeleteShop,
} from "api/toolCheckouts";
import ReservationSettingsFields, { ReservationSettingsValue } from "./ReservationSettingsFields";
import ShopColorField from "./ShopColorField";
import { useCapabilities } from "app/permissions";
import MemberSearchInput from "ui/common/MemberSearchInput";
import { SelectOption } from "ui/common/AsyncSelect";
import ShopAnnotationCell from "./ShopAnnotationCell";
import RequestorAnnotationHelp from "./RequestorAnnotationHelp";

const rowId = (s: Shop) => s.id;
const normalizedName = (value: string) => value.trim().toLowerCase();
const normalizedChannel = (value: string) => value.replace(/^#+/, "");

export const resourceManagerIdsUpdate = (
  canManageResourceManagers: boolean,
  managers?: Array<{ id: string }>
) => canManageResourceManagers && managers !== undefined
  ? { resourceManagerIds: managers.map(manager => manager.id) }
  : {};

const ResourceManagersField: React.FC<{
  managers: Array<{ id: string; name: string }>;
  onChange: (managers: Array<{ id: string; name: string }>) => void;
}> = ({ managers, onChange }) => {
  const [searchKey, setSearchKey] = React.useState(0);
  const addManager = (selection: SelectOption) => {
    if (!selection || managers.some(manager => manager.id === selection.value)) return;
    onChange([...managers, { id: selection.value, name: selection.label }]);
    setSearchKey(key => key + 1);
  };

  return <Grid size={{ xs: 12 }}>
    <Typography variant="body2" component="div" sx={{ mb: 1 }}>
      Shop resource managers
      <Tooltip title="Resource managers can administer this shop's tools, checkout requests, and reservations.">
        <IconButton size="small" aria-label="About shop resource managers" sx={{ ml: 0.5, p: 0.25 }}>
          <InfoOutlinedIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    </Typography>
    <MemberSearchInput key={searchKey} name="resourceManager" ariaLabel="Add a shop resource manager"
      placeholder="Search for a member to add"
      excludeIds={managers.map(manager => manager.id)} onChange={addManager} />
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {managers.map(manager => <Chip key={manager.id} label={manager.name}
        onDelete={() => onChange(managers.filter(candidate => candidate.id !== manager.id))} />)}
      {managers.length === 0 && <Typography variant="caption" color="textSecondary">
        No resource managers assigned.
      </Typography>}
    </div>
  </Grid>;
};

// ── AddShopModal ──────────────────────────────────────────────────────────────

interface AddShopModalProps {
  shops: Shop[];
  onClose: () => void;
  onSave: (body: Partial<Shop>) => void;
  loading: boolean;
  error: string;
}

export const AddShopModal: React.FC<AddShopModalProps> = ({ shops, onClose, onSave, loading, error }) => {
  const [requestorAnnotation, setRequestorAnnotation] = React.useState("");
  const [name, setName] = React.useState("");
  const [wikiUrl, setWikiUrl] = React.useState("");
  const [gdriveId, setGdriveId] = React.useState("");
  const [slackChannel, setSlackChannel] = React.useState("");
  const [colorId, setColorId] = React.useState("1");
  const [localError, setLocalError] = React.useState("");
  const [resourceManagers, setResourceManagers] = React.useState<Array<{ id: string; name: string }>>([]);
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
    onSave({ name: trimmedName, wikiUrlOverride: wikiUrl, gdriveId, slackChannel, colorId, requestorAnnotation: requestorAnnotation.trim() || null, resourceManagerIds: resourceManagers.map(manager => manager.id), ...reservation });
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
          <TextField fullWidth label="Wiki URL" value={wikiUrl}
            onChange={e => setWikiUrl(e.target.value)}
            helperText="Optional. Defaults to WIKI_URL/workshops/slugified-shop-name." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="GDrive ID" value={gdriveId}
            onChange={e => setGdriveId(e.target.value)}
            helperText="Optional Google Drive folder ID." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ShopColorField value={colorId} onChange={setColorId} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <TextField fullWidth multiline minRows={2} label="Annotation for requestors"
              value={requestorAnnotation} onChange={event => setRequestorAnnotation(event.target.value)}
              helperText="Sent after a checkout request when the tool has no annotation. Leave blank for no shop message." />
            <RequestorAnnotationHelp level="shop" />
          </div>
        </Grid>
        <ResourceManagersField managers={resourceManagers} onChange={setResourceManagers} />
        <ReservationSettingsFields value={reservation} onChange={setReservation} />
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Slack Channel" placeholder="e.g. shop-woodworking"
            value={slackChannel} onChange={e => setSlackChannel(normalizedChannel(e.target.value))}
            helperText="Used to route /checkout slash commands to this shop" />
        </Grid>
      </Grid>
    </FormModal>
  );
};

// ── EditShopModal ─────────────────────────────────────────────────────────────

interface EditShopModalProps {
  shop: Shop;
  tools: Tool[];
  onSave: (id: string, body: Partial<Shop>) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  canManageResourceManagers: boolean;
}

export const EditShopModal: React.FC<EditShopModalProps> = ({
  shop, tools, onSave, onCancel, saving, error, canManageResourceManagers
}) => {
  const [requestorAnnotation, setRequestorAnnotation] = React.useState(shop.requestorAnnotation || "");
  const [name, setName] = React.useState(shop.name);
  const [wikiUrl, setWikiUrl] = React.useState(shop.wikiUrlOverride || "");
  const [gdriveId, setGdriveId] = React.useState(shop.gdriveId || "");
  const [slackChannel, setSlackChannel] = React.useState(shop.slackChannel || "");
  const [colorId, setColorId] = React.useState(shop.colorId || "1");
  // Undefined means the API did not include the authoritative assignments.
  // Preserve that distinction from an explicitly empty list so an unrelated
  // edit cannot accidentally revoke every existing manager.
  const [resourceManagers, setResourceManagers] = React.useState(shop.resourceManagers);
  // Only the reservation-specific fields -- seeding this from the full shop
  // object let its name/wikiUrlOverride/gdriveId/slackChannel/colorId leak
  // in, which then silently overwrote whatever the user just edited via the
  // trailing `...reservation` spread in submit() below.
  const [reservation, setReservation] = React.useState<ReservationSettingsValue>({
    reservable: shop.reservable,
    maxConcurrentReservations: shop.maxConcurrentReservations,
    reservationHorizonDays: shop.reservationHorizonDays,
    minimumAdvanceNoticeHours: shop.minimumAdvanceNoticeHours ?? 2,
    prohibitSameDayReservations: shop.prohibitSameDayReservations ?? false,
    reservationFullDay: shop.reservationFullDay,
    durationFees: shop.durationFees,
    maxReservationDurationHours: shop.maxReservationDurationHours,
    reservationRequiresApproval: shop.reservationRequiresApproval,
    reservationPrerequisiteToolIds: shop.reservationPrerequisiteToolIds,
  });

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(shop.id, {
      name: trimmedName, wikiUrlOverride: wikiUrl, gdriveId, slackChannel, colorId,
      requestorAnnotation: requestorAnnotation.trim() || null,
      ...resourceManagerIdsUpdate(canManageResourceManagers, resourceManagers),
      ...reservation
    });
  };

  return (
    <FormModal id="edit-shop" isOpen={true} title={`Edit ${shop.name}`}
      closeHandler={onCancel}
      onSubmit={submit}
      submitText="Save Shop" loading={saving} error={error}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth required label="Shop Name" value={name}
            onChange={event => setName(event.target.value)} autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Wiki URL" value={wikiUrl}
            onChange={event => setWikiUrl(event.target.value)}
            helperText="Leave blank to use the generated workshop URL." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="GDrive ID" value={gdriveId}
            onChange={event => setGdriveId(event.target.value)}
            helperText="Optional Google Drive folder ID." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ShopColorField value={colorId} onChange={setColorId} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <TextField fullWidth multiline minRows={2} label="Annotation for requestors"
              value={requestorAnnotation} onChange={event => setRequestorAnnotation(event.target.value)}
              helperText="Sent after a checkout request when the tool has no annotation. Leave blank for no shop message." />
            <RequestorAnnotationHelp level="shop" />
          </div>
        </Grid>
        {canManageResourceManagers && resourceManagers !== undefined &&
          <ResourceManagersField managers={resourceManagers} onChange={setResourceManagers} />}
        {canManageResourceManagers && resourceManagers === undefined &&
          <Grid size={{ xs: 12 }}>
            <Alert severity="warning">
              Resource manager assignments are unavailable. Saving will preserve the existing assignments.
            </Alert>
          </Grid>}
        <ReservationSettingsFields value={reservation} onChange={setReservation} tools={tools} />
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Slack Channel" placeholder="e.g. shop-woodworking"
            value={slackChannel} onChange={event => setSlackChannel(normalizedChannel(event.target.value))}
            helperText="Used to route /checkout and /reserve slash commands to this shop" />
        </Grid>
      </Grid>
    </FormModal>
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
  const [qrShop, setQrShop] = React.useState<Shop | null>(null);
  const [addOpen,      setAddOpen]      = React.useState(false);
  const [editingId,    setEditingId]    = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Shop | null>(null);
  const [selectedId,   setSelectedId]   = React.useState<string | undefined>(undefined);

  const { isRequesting, data: publicShops = [], refresh, error: loadError } =
    useCheckoutCatalog("shops");
  const { data: managedShops = [], refresh: refreshManaged, error: managedError, isRequesting: loadingManaged } = useCheckoutCatalog("managedShops");
  const { data: tools = [] } = useCheckoutCatalog("tools");
  const { canManageCheckoutApprovers, canViewShopQrCodes } = useCapabilities();

  const refreshShops = React.useCallback(() => {
    refresh();
    // Outside CheckoutCatalogProvider (e.g. Reservations), these are separate
    // reads. Inside it, both callbacks are the same shared catalog refresh.
    if (refreshManaged !== refresh) refreshManaged();
  }, [refresh, refreshManaged]);

  // Keep management-only shops selectable and prefer their complete records.
  const shops = React.useMemo(() => Array.from(new Map(
    [...publicShops, ...managedShops].map((shop: Shop) => [shop.id, shop])
  ).values()), [publicShops, managedShops]);
  const selectedPublicShop = (publicShops as Shop[]).find(s => s.id === selectedId);
  const selectedManagedShop = (managedShops as Shop[]).find(s => s.id === selectedId);
  const editingShop = (managedShops as Shop[]).find(s => s.id === editingId);

  const onSuccess = React.useCallback(() => {
    setAddOpen(false); setEditingId(null); setDeleteTarget(null);
    setSelectedId(undefined); refreshShops();
  }, [refreshShops]);

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
      cell: (row: Shop) => <strong>{row.name}</strong>,
    },
    {
      id: "slackChannel", label: "Slack Channel",
      cell: (row: Shop) => (
        <span style={{ color: row.slackChannel ? "inherit" : "#aaa" }}>
          {row.slackChannel ? `#${row.slackChannel.replace(/^#+/, "")}` : "Not configured"}
        </span>
      ),
    },
    {
      id: "reservable", label: "Reservations",
      cell: (row: Shop) => (
        <span>{row.reservable ? `${row.maxConcurrentReservations} concurrent, ${row.reservationHorizonDays} days` : "Not reservable"}</span>
      ),
    },
    {
      id: "requestorAnnotation", label: "Annotation for requestors",
      cell: (row: Shop) => (managedShops as Shop[]).some(shop => shop.id === row.id)
        ? <ShopAnnotationCell shop={row} onSaved={refreshShops} />
        : <span>—</span>,
    },
    {
      id: "toolCount", label: "Tools",
      cell: (row: Shop) => <span>{(row as any).toolCount ?? 0}</span>,
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {selectedPublicShop && canViewShopQrCodes && <Button variant="outlined" startIcon={<QrCodeIcon />}
              onClick={() => setQrShop(selectedPublicShop)}>QR Code</Button>}
            {selectedManagedShop && !editingId && (
              <>
                <Button variant="outlined" color="primary" startIcon={<EditIcon />}
                  onClick={() => setEditingId(selectedManagedShop.id)}>
                  Edit
                </Button>
                {canManageCheckoutApprovers && <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />}
                  onClick={() => setDeleteTarget(selectedManagedShop)}>
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

      {managedError && <Grid size={{ xs: 12 }}>
        <Alert severity="error">
          Could not load shop management settings. Edit and Delete are unavailable until this request succeeds.
          <div>{managedError}</div>
          <Button color="inherit" onClick={refreshManaged} disabled={loadingManaged}>
            {loadingManaged ? "Retrying…" : "Retry management settings"}
          </Button>
        </Alert>
      </Grid>}
      {(loadError || updateError) && <Grid size={{ xs: 12 }}><ErrorMessage error={loadError || updateError} /></Grid>}

      <Grid size={{ xs: 12 }} style={{ position: "relative" }}>
        <StatefulTable
          id="shops-table" title="Shops" loading={isRequesting || loadingManaged}
          data={shops as Shop[]} columns={columns}
          rowId={rowId} totalItems={shops.length}
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

      {qrShop && <PublicCatalogQrCodeModal key={qrShop.id} kind="shop" resource={qrShop} onClose={() => setQrShop(null)} />}
      {editingShop && (
        <EditShopModal
          key={editingShop.id}
          shop={editingShop}
          tools={(tools as Tool[]).filter(tool => tool.shopId === editingShop.id)}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={updating}
          error={updateError}
          canManageResourceManagers={canManageCheckoutApprovers}
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
