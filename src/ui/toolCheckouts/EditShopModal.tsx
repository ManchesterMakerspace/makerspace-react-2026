import * as React from "react";
import { Grid, TextField } from "@mui/material";
import { Shop, Tool } from "app/entities/toolCheckout";
import { useCapabilities } from "app/permissions";
import FormModal from "ui/common/FormModal";
import ShopResourceManagersField from "./ShopResourceManagersField";
import ShopColorField from "./ShopColorField";
import ReservationSettingsFields, { ReservationSettingsValue } from "./ReservationSettingsFields";
const normalizedChannel = (value: string) => value.replace(/^#+/, "");

interface EditShopModalProps {
  shop: Shop;
  tools: Tool[];
  onSave: (id: string, body: Partial<Shop>) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}

export const EditShopModal: React.FC<EditShopModalProps> = ({
  shop, tools, onSave, onCancel, saving, error
}) => {
  const { canEditMembers } = useCapabilities();
  const [managers, setManagers] = React.useState(shop.resourceManagers || []);
  const [name, setName] = React.useState(shop.name);
  const [wikiUrl, setWikiUrl] = React.useState(shop.wikiUrlOverride || "");
  const [gdriveId, setGdriveId] = React.useState(shop.gdriveId || "");
  const [slackChannel, setSlackChannel] = React.useState(shop.slackChannel || "");
  const [colorId, setColorId] = React.useState(shop.colorId || "1");
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
    onSave(shop.id, { name: trimmedName, wikiUrlOverride: wikiUrl, gdriveId, slackChannel, colorId, ...(canEditMembers && { resourceManagerIds: managers.map(m => m.id) }), ...reservation });
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
          {canEditMembers && <ShopResourceManagersField value={managers} onChange={setManagers} disabled={saving} />}
          <ShopColorField value={colorId} onChange={setColorId} />
        </Grid>
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

