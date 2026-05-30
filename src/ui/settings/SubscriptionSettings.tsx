import * as React from "react";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import { listRentals, Rental } from "makerspace-ts-api-client";

import LoadingOverlay from "ui/common/LoadingOverlay";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { useAuthState } from "ui/reducer/hooks";
import SubscriptionDetails from "ui/subscriptions/SubscriptionDetails";
import { RentalStatus } from "app/entities/rentalSpot";

const SubscriptionSettings: React.FC = () => {
  const { currentUser } = useAuthState();
  const { subscriptionId } = currentUser;

  const [subscriptionsLoading, setSubscriptionsLoading] = React.useState(
    { ...subscriptionId && { [subscriptionId]: true } }
  );
  const [subRentals, setSubRentals] = React.useState<Rental[]>([]);

  const { isRequesting: rentalsLoading, data: rentals = [] } = useReadTransaction(
    listRentals, {}, undefined, "subscription-list-rentals"
  );

  React.useEffect(() => {
    // Only show active/vacating rentals that have a subscription
    const subs = rentals.filter(rental =>
      !!rental.subscriptionId &&
      (!(rental as any).status ||
        (rental as any).status === RentalStatus.Active ||
        (rental as any).status === RentalStatus.Vacating)
    );
    setSubscriptionsLoading(curr => ({
      ...curr,
      ...subs.reduce((states, sub) => ({ ...states, [sub.subscriptionId]: true }), {})
    }));
    setSubRentals(subs);
  }, [rentals]);

  const reportLoad = React.useCallback(
    (subId: string) => (loadState?: boolean) => {
      setSubscriptionsLoading(curr => ({ ...curr, [subId]: !!loadState }));
    },
    [setSubscriptionsLoading]
  );

  const isLoading = Object.values(subscriptionsLoading).some(l => l) || rentalsLoading;

  return (
    <>
      {isLoading && <LoadingOverlay id="subscription-settings" contained={true} />}
      <Grid container spacing={8} style={{ ...isLoading && { display: "none" } }}>
        {/* Membership subscription */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="h4" gutterBottom>Membership</Typography>
          <SubscriptionDetails onLoad={reportLoad(subscriptionId)} subscriptionId={subscriptionId} />
        </Grid>

        {/* Rental subscriptions — one section per rental with spot label */}
        {!!subRentals.length && (
          <>
            <Grid size={{ xs: 12 }}>
              <Divider />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="h4" gutterBottom>Rentals</Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: "16px" }}>
                Each rental subscription is listed separately below. To cancel a rental, go to your profile Rentals tab.
              </Typography>
            </Grid>
          </>
        )}

        {subRentals.map(rental => (
          <Grid size={{ xs: 12 }} key={rental.subscriptionId}>
            {/* Spot identifier header */}
            <div style={{
              padding: "8px 12px", backgroundColor: "#f0f4f8",
              borderRadius: "4px 4px 0 0", borderBottom: "1px solid #ddd",
              display: "flex", alignItems: "center", gap: "8px"
            }}>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {rental.number}
              </Typography>
              {rental.description && (
                <Typography variant="body2" color="textSecondary">
                  — {rental.description}
                </Typography>
              )}
              {(rental as any).status === RentalStatus.Vacating && (
                <Typography variant="caption" style={{
                  backgroundColor: "#fff3e0", border: "1px solid #ffb74d",
                  borderRadius: "3px", padding: "1px 6px", color: "#e65100"
                }}>
                  Vacating
                </Typography>
              )}
            </div>
            <div style={{ border: "1px solid #ddd", borderTop: "none", borderRadius: "0 0 4px 4px", padding: "12px" }}>
              <SubscriptionDetails
                onLoad={reportLoad(rental.subscriptionId)}
                subscriptionId={rental.subscriptionId}
              />
            </div>
          </Grid>
        ))}
      </Grid>
    </>
  );
};

export default SubscriptionSettings;
