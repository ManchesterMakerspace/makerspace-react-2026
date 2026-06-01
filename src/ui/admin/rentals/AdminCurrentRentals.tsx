import * as React from "react";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import { Link } from "react-router-dom";
import moment from "ui/utils/moment";
import { Rental, adminListRentals } from "makerspace-ts-api-client";

import StatefulTable from "ui/common/table/StatefulTable";
import { SortDirection } from "ui/common/table/constants";
import { Column } from "ui/common/table/Table";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import { timeToDate } from "ui/utils/timeToDate";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import extractTotalItems from "ui/utils/extractTotalItems";
import CreateRentalAdmin from "ui/rentals/CreateRentalAdmin";
import EditRental from "ui/rentals/EditRental";
import RenewRental from "ui/rentals/RenewRental";
import DeleteRentalModal from "ui/rentals/DeleteRentalModal";
import { useCapabilities } from "app/permissions";
import { RentalStatus } from "app/entities/rentalSpot";
import { markRentalVacated } from "api/rentals";
import { withQueryContext, useQueryContext } from "ui/common/Filters/QueryContext";

const rowId = (rental: Rental) => rental.id;

const getRentalStatus = (row: Rental): { label: string; color: Status } => {
  const status = (row as any).status as RentalStatus;
  if (status && status !== RentalStatus.Active) {
    switch (status) {
      case RentalStatus.Pending:          return { label: "Pending Approval",   color: Status.Warn };
      case RentalStatus.PendingAgreement: return { label: "Pending Agreement",  color: Status.Warn };
      case RentalStatus.Vacating:         return { label: "Vacating",           color: Status.Warn };
      case RentalStatus.Cancelled:        return { label: "Cancelled",          color: Status.Default };
      case RentalStatus.Denied:           return { label: "Denied",             color: Status.Danger };
      case RentalStatus.AgreementDenied:  return { label: "Agreement Declined", color: Status.Danger };
    }
  }
  const expired = row.expiration && moment(row.expiration).valueOf() < Date.now();
  return { label: expired ? "Expired" : "Active", color: expired ? Status.Danger : Status.Success };
};

const AdminCurrentRentalsInner: React.FC = () => {
  const { canDeleteRentals: isAdmin } = useCapabilities();
  const [selectedId, setSelectedId] = React.useState<string>();
  const { params } = useQueryContext();

  const { isRequesting, data: rentals = [], response, refresh, error } = useReadTransaction(
    adminListRentals,
    params as any,
    undefined,
    "admin-current-rentals"
  );

  const onAction = React.useCallback(() => {
    refresh();
    setSelectedId(null);
  }, [refresh]);

  const selectedRental   = rentals.find(r => r.id === selectedId);
  const selectedVacating = (selectedRental as any)?.status === "vacating";

  const onMarkVacatedSuccess = React.useCallback(() => { refresh(); setSelectedId(null); }, [refresh]);
  const { call: doMarkVacated, isRequesting: markingVacated } = useWriteTransaction(markRentalVacated, onMarkVacatedSuccess);

  const columns: Column<Rental>[] = [
    {
      id: "number", label: "Number",
      cell: (r: Rental) => r.number,
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: "description", label: "Description",
      cell: (r: Rental) => r.description,
    },
    {
      id: "expiration", label: "Expiration Date",
      cell: (r: Rental) => r.expiration ? timeToDate(r.expiration) : "N/A",
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: "member", label: "Member",
      cell: (r: Rental) => <Link to={`/members/${r.memberId}`}>{r.memberName}</Link>,
      width: 200,
    },
    {
      id: "status", label: "Status",
      cell: (r: Rental) => {
        const { label, color } = getRentalStatus(r);
        const status  = (r as any).status as RentalStatus;
        if (status === RentalStatus.Denied || status === RentalStatus.AgreementDenied) {
          const notes  = (r as any).notes || "";
          const match  = notes.match(/(?:Denied|Agreement declined)[:\s]+(.+?)(\s*\|.*)?$/i);
          const reason = match ? match[1].trim() : "No reason provided";
          return (
            <Tooltip title={`Reason: ${reason}`} placement="top">
              <span><StatusLabel label={label} color={color} /></span>
            </Tooltip>
          );
        }
        return <StatusLabel label={label} color={color} />;
      },
    },
  ];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="flex-end" alignItems="center">
          <Grid>
            <CreateRentalAdmin onCreate={onAction} />
            <EditRental rental={selectedRental} onUpdate={onAction} />
            <RenewRental rental={selectedRental} onRenew={onAction} />
            {selectedVacating && (
              <Button
                id="rentals-list-mark-vacated"
                variant="outlined"
                color="secondary"
                disabled={markingVacated}
                onClick={() => selectedRental && doMarkVacated({ id: selectedRental.id })}
                style={{ marginRight: "8px" }}
              >
                Mark Vacated
              </Button>
            )}
            {isAdmin && <DeleteRentalModal rental={selectedRental} onDelete={onAction} />}
          </Grid>
        </Grid>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <StatefulTable
          id="rentals-table"
          title="Rentals"
          loading={isRequesting}
          data={Object.values(rentals)}
          error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId}
          setSelectedIds={setSelectedId}
          columns={columns}
          rowId={rowId}
          renderSearch={true}
        />
      </Grid>
    </Grid>
  );
};

export default withQueryContext(AdminCurrentRentalsInner);
