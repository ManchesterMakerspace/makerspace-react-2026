import * as React from "react";
import moment from "ui/utils/moment";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import { Rental, listRentals, Member } from "makerspace-ts-api-client";

import StatefulTable from "ui/common/table/StatefulTable";
import { SortDirection } from "ui/common/table/constants";
import { Column } from "ui/common/table/Table";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import ErrorMessage from "ui/common/ErrorMessage";
import { timeToDate } from "ui/utils/timeToDate";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { cancelRental, markRentalVacated } from "api/rentals";
import { RentalStatus, RentalStatusDisplay } from "app/entities/rentalSpot";
import { withQueryContext, useQueryContext } from "ui/common/Filters/QueryContext";
import extractTotalItems from "ui/utils/extractTotalItems";

const rowId = (rental: Rental) => rental.id;

const statusColor = (status: string): Status => {
  switch (status) {
    case RentalStatus.Active:           return Status.Success;
    case RentalStatus.Pending:          return Status.Warn;
    case RentalStatus.PendingAgreement: return Status.Warn;
    case RentalStatus.Vacating:         return Status.Warn;
    case RentalStatus.Cancelled:        return Status.Default;
    case RentalStatus.AgreementDenied:  return Status.Danger;
    case RentalStatus.Denied:           return Status.Danger;
    default:                            return Status.Default;
  }
};

const getDenialReason = (rental: Rental): string => {
  const notes = (rental as any).notes || "";
  const match = notes.match(/Denied: (.+?)(\s*\|.*)?$/);
  return match ? match[1].trim() : "Contact us for details.";
};

type CancelStep = "confirm" | "vacated";
type ModalMode  = "cancel" | "mark_vacated";

const MemberRentalsList: React.FC<{ member: Member; onUpdate?: () => void }> = ({ member, onUpdate }) => {
  const [cancelTarget, setCancelTarget] = React.useState<Rental | null>(null);
  const [cancelStep,   setCancelStep]   = React.useState<CancelStep>("confirm");
  const [modalMode,    setModalMode]    = React.useState<ModalMode>("cancel");
  const [selectedId,   setSelectedId]   = React.useState<string>(undefined);
  const { params, changePage } = useQueryContext();

  const { isRequesting, data: rentals = [], response, refresh, error } = useReadTransaction(
    listRentals, { ...params }, undefined, "member-rentals-list"
  );

  const selectedRental = (rentals as Rental[]).find(r => r.id === selectedId);
  const selectedStatus = selectedRental ? (selectedRental as any).status as RentalStatus : null;
  const isCancellable  = selectedStatus == null || [RentalStatus.Active, RentalStatus.Pending, RentalStatus.PendingAgreement].includes(selectedStatus);
  const isVacating     = selectedStatus === RentalStatus.Vacating;

  const openCancel = (rental: Rental) => {
    setCancelTarget(rental); setCancelStep("confirm"); setModalMode("cancel");
  };

  const openMarkVacated = (rental: Rental) => {
    setCancelTarget(rental); setModalMode("mark_vacated");
  };

  const closeModal = () => {
    setCancelTarget(null); setCancelStep("confirm"); setModalMode("cancel");
  };

  const onSuccess = React.useCallback(() => {
    closeModal(); refresh(); changePage(0); onUpdate && onUpdate();
  }, [refresh, changePage, onUpdate]);

  const { call: doCancel,      isRequesting: cancelling,     error: cancelError }      = useWriteTransaction(cancelRental,      onSuccess);
  const { call: doMarkVacated, isRequesting: markingVacated, error: markVacatedError } = useWriteTransaction(markRentalVacated, onSuccess);

  const handleVacated    = (vacated: boolean) => { if (cancelTarget) doCancel({ id: cancelTarget.id, body: { vacated } }); };
  const handleMarkVacated = () => { if (cancelTarget) doMarkVacated({ id: cancelTarget.id }); };

  const isRequesting2 = cancelling || markingVacated;
  const activeError   = cancelError || markVacatedError;

  const columns: Column<Rental>[] = [
    {
      id: "number", label: "Rental",
      cell: (row: Rental) => row.number,
      defaultSortDirection: SortDirection.Asc,
    },
    {
      id: "description", label: "Description",
      cell: (row: Rental) => row.description || "—",
    },
    {
      id: "expiration", label: "Expiration",
      cell: (row: Rental) => row.expiration ? timeToDate(row.expiration) : "—",
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: "status", label: "Status",
      cell: (row: Rental) => {
        const status = (row as any).status as RentalStatus;

        if (!status || status === RentalStatus.Active) {
          const expired = row.expiration && moment(row.expiration).valueOf() < Date.now();
          return <StatusLabel label={expired ? "Expired" : "Active"} color={expired ? Status.Danger : Status.Success} />;
        }

        if (status === RentalStatus.Denied) {
          const reason = getDenialReason(row);
          return (
            <Tooltip title={`Reason: ${reason}`} placement="top">
              <span><StatusLabel label="Denied" color={Status.Danger} /></span>
            </Tooltip>
          );
        }

        return (
          <StatusLabel
            label={RentalStatusDisplay[status] || status}
            color={statusColor(status)}
          />
        );
      },
    },
  ];

  const expiryDisplay = cancelTarget?.expiration
    ? timeToDate(cancelTarget.expiration)
    : "the end of your current rental period";

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="flex-end" alignItems="center" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedRental && isCancellable && (
              <Button variant="outlined" color="secondary"
                onClick={() => openCancel(selectedRental)}>
                Cancel Rental
              </Button>
            )}
            {selectedRental && isVacating && (
              <Button variant="outlined" color="secondary"
                onClick={() => openMarkVacated(selectedRental)}>
                Mark Vacated
              </Button>
            )}
          </div>
        </Grid>

        <StatefulTable
          id="member-rentals-table" title="My Rentals"
          loading={isRequesting} data={Object.values(rentals)} error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId} setSelectedIds={setSelectedId}
          columns={columns} rowId={rowId} renderSearch={false}
        />
      </Grid>

      {/* Cancel — Step 1 */}
      <Dialog open={!!cancelTarget && modalMode === "cancel" && cancelStep === "confirm"} onClose={closeModal}>
        <DialogTitle>Cancel Rental</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to cancel your rental of <strong>{cancelTarget?.number}</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary">
            No further charges will be made after your current rental period ends.
          </Typography>
          <ErrorMessage error={activeError} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Keep Rental</Button>
          <Button color="secondary" variant="contained" onClick={() => setCancelStep("vacated")}>
            Yes, Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel — Step 2 */}
      <Dialog open={!!cancelTarget && modalMode === "cancel" && cancelStep === "vacated"} onClose={closeModal}>
        <DialogTitle>Have You Vacated Your Rental?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Have you already removed your belongings from rental <strong>{cancelTarget?.number}</strong>?
          </Typography>
          <Typography variant="body2" style={{ marginTop: "8px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
            <strong>Yes</strong> — Your rental will end immediately and the space will be available for other members.
          </Typography>
          <Typography variant="body2" style={{ marginTop: "8px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
            <strong>No</strong> — Your rental will remain active until <strong>{expiryDisplay}</strong>. Please ensure you have vacated by then.
          </Typography>
          <ErrorMessage error={activeError} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} disabled={isRequesting2}>Back</Button>
          <Button variant="outlined" color="secondary" disabled={isRequesting2}
            onClick={() => handleVacated(false)}>
            {isRequesting2 ? "Processing..." : "No, Not Yet"}
          </Button>
          <Button variant="contained" color="secondary" disabled={isRequesting2}
            onClick={() => handleVacated(true)}>
            {isRequesting2 ? "Processing..." : "Yes, I Have Vacated"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Vacated */}
      <Dialog open={!!cancelTarget && modalMode === "mark_vacated"} onClose={closeModal}>
        <DialogTitle>Mark Rental as Vacated</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Have you removed all your belongings from rental <strong>{cancelTarget?.number}</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Confirming will immediately end your rental and return the space to the available pool.
          </Typography>
          <ErrorMessage error={activeError} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} disabled={isRequesting2}>Cancel</Button>
          <Button variant="contained" color="secondary" disabled={isRequesting2}
            onClick={handleMarkVacated}>
            {isRequesting2 ? "Processing..." : "Yes, I Have Vacated"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default withQueryContext(MemberRentalsList);
