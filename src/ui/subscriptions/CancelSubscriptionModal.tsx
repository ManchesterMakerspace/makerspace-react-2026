import * as React from "react";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

import FormModal from "ui/common/FormModal";
import { isCanceled } from "ui/subscriptions/utils";
import { adminCancelSubscription, cancelSubscription, Subscription } from "makerspace-ts-api-client";
import { useAuthState } from "../reducer/hooks";
import { useCapabilities } from "app/permissions";
import useWriteTransaction from "../hooks/useWriteTransaction";
import { ActionButton } from "../common/ButtonRow";
import useModal from "../hooks/useModal";
import { SubscriptionDetailsInner } from "./SubscriptionDetails";
import { timeToDate } from "../utils/timeToDate";
import { getSubscriptionCancellationImpact } from "api/reservations";
import { SubscriptionCancellationImpact } from "app/entities/reservation";

interface Props {
  subscription: Subscription;
  onSuccess: () => void;
}

const CancelSubscriptionModal: React.FC<Props> = ({ subscription, onSuccess }) => {
  const { currentUser: { id } } = useAuthState();
  const { canCancelOtherSubscriptions } = useCapabilities();
  const { isOpen, openModal, closeModal } = useModal();
  const asAdmin = canCancelOtherSubscriptions && id !== subscription.memberId;
  const isRental = subscription.resourceClass === "Rental";
  const [impact, setImpact] = React.useState<SubscriptionCancellationImpact | null>(null);
  const [impactLoading, setImpactLoading] = React.useState(false);
  const [impactError, setImpactError] = React.useState("");

  const { isRequesting, error, call } = useWriteTransaction(asAdmin ? adminCancelSubscription : cancelSubscription, () => {
    closeModal();
    onSuccess();
  });

  const onSubmit = React.useCallback(() => {
    if (!isRental && !impact) return;
    call({ id: subscription.id });
  }, [call, subscription.id, isRental, impact]);

  React.useEffect(() => {
    if (!isOpen || isRental) {
      setImpact(null);
      setImpactLoading(false);
      setImpactError("");
      return;
    }

    setImpactLoading(true);
    setImpactError("");
    getSubscriptionCancellationImpact({ id: subscription.id, admin: asAdmin }).then(result => {
      setImpact(result.data || null);
      setImpactError(result.error?.message || "");
      setImpactLoading(false);
    });
  }, [isOpen, isRental, subscription.id, asAdmin]);

  const disableButton = isCanceled(subscription);
  const whosSubscription = asAdmin ? (subscription.memberName ? `${subscription.memberName}'s` : "this") : "your";

  const warningText = isRental ? (
    <>
      <Typography gutterBottom>
        Cancelling {whosSubscription} subscription will also cancel the associated active rental.
        {subscription.nextBillingDate && (
          <> Access will continue until <strong>{timeToDate(subscription.nextBillingDate)}</strong>, after which the rental will be marked as vacating.</>
        )}
        {" "}This action cannot be undone.
      </Typography>
    </>
  ) : (
    <Typography gutterBottom>
      Are you sure you want to cancel {whosSubscription} subscription? This action cannot be undone.
    </Typography>
  );

  return (
    <>
     <ActionButton
        id="subscription-option-cancel"
        color="secondary"
        variant="outlined"
        disabled={disableButton}
        label="Cancel Subscription"
        onClick={openModal}
      />
      {isOpen && (
        <FormModal
          id="cancel-subscription"
          loading={isRequesting || impactLoading}
          isOpen={isOpen}
          closeHandler={closeModal}
          title={isRental ? "Cancel Rental Subscription" : "Cancel Subscription"}
          onSubmit={onSubmit}
          submitText="Submit"
          cancelText="Close"
          error={error}
        >
          {warningText}
          {impactError && (
            <Alert severity="error" style={{ marginBottom: 16 }}>
              Reservation impact could not be checked: {impactError}
            </Alert>
          )}
          {impact && impact.reservationCount > 0 && (
            <Alert severity="warning" style={{ marginBottom: 16 }}>
              Cancelling this recurring membership will also cancel {impact.reservationCount} reservation
              {impact.reservationCount === 1 ? "" : "s"} that extend beyond the current membership period:
              <ul>
                {impact.reservations.map(reservation => (
                  <li key={reservation.id}>
                    {reservation.calendarHtmlLink
                      ? <a href={reservation.calendarHtmlLink} target="_blank" rel="noopener noreferrer">
                          {reservation.title}
                        </a>
                      : reservation.title} — ends {new Date(reservation.endAt).toLocaleString(undefined, {
                      hour12: false,
                      timeZone: "America/New_York"
                    })}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <SubscriptionDetailsInner subscription={subscription} />
        </FormModal>
      )}
    </>
  );
};

export default CancelSubscriptionModal;
