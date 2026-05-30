import * as React from "react";
import moment from "moment";
import { Link } from 'react-router-dom';
import Grid from "@mui/material/Grid2";
import Tooltip from "@mui/material/Tooltip";
import { Rental, listRentals, adminListRentals, Member } from "makerspace-ts-api-client";

import StatefulTable from "ui/common/table/StatefulTable";
import { SortDirection } from "ui/common/table/constants";
import { Column } from "ui/common/table/Table";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import { timeToDate } from "ui/utils/timeToDate";
import DeleteRentalModal from "ui/rentals/DeleteRentalModal";
import useReadTransaction from "ui/hooks/useReadTransaction";
import CreateRentalAdmin from "ui/rentals/CreateRentalAdmin";
import RenewRental from "ui/rentals/RenewRental";
import EditRental from "ui/rentals/EditRental";
import extractTotalItems from "ui/utils/extractTotalItems";
import { useAuthState } from "ui/reducer/hooks";
import { useCapabilities } from "app/permissions";
import { useQueryContext, withQueryContext } from "ui/common/Filters/QueryContext";
import { RentalStatus, RentalStatusDisplay } from "app/entities/rentalSpot";

const rowId = (rental: Rental) => rental.id;

const getRentalStatus = (row: Rental): { label: string; color: Status } => {
  const status = (row as any).status as RentalStatus;

  if (status && status !== RentalStatus.Active) {
    switch (status) {
      case RentalStatus.Pending:   return { label: "Pending Approval", color: Status.Warn };
      case RentalStatus.Vacating:  return { label: "Vacating",         color: Status.Warn };
      case RentalStatus.Cancelled: return { label: "Cancelled",        color: Status.Default };
      case RentalStatus.Denied:    return { label: "Denied",           color: Status.Danger };
    }
  }

  // Legacy / active — use expiration
  const expired = row.expiration && moment(row.expiration).valueOf() < Date.now();
  return {
    label: expired ? "Expired" : "Active",
    color: expired ? Status.Danger : Status.Success,
  };
};

const RentalsList: React.FC<{ member?: Member }> = ({ member }) => {
  const { currentUser: { id } } = useAuthState();
  const { canManageRentals: canManage, canDeleteRentals: isAdmin } = useCapabilities();
  const asAdmin = canManage && id !== (member && member.id);

  const fields: Column<Rental>[] = [
    {
      id: "number", label: "Number",
      cell: (row: Rental) => row.number,
      defaultSortDirection: SortDirection.Desc,
    },
    {
      id: "description", label: "Description",
      cell: (row: Rental) => row.description,
    },
    {
      id: "expiration", label: "Expiration Date",
      cell: (row: Rental) => row.expiration ? timeToDate(row.expiration) : "N/A",
      defaultSortDirection: SortDirection.Desc,
    },
    ...asAdmin ? [{
      id: "member", label: "Member",
      cell: (row: Rental) => <Link to={`/members/${row.memberId}`}>{row.memberName}</Link>,
      defaultSortDirection: SortDirection.Desc,
      width: 200
    }] : [],
    {
      id: "status", label: "Status",
      cell: (row: Rental) => {
        const { label, color } = getRentalStatus(row);
        const status = (row as any).status as RentalStatus;

        // Show denial reason as tooltip
        if (status === RentalStatus.Denied) {
          const notes = (row as any).notes || "";
          const match = notes.match(/Denied: (.+?)(\s*\|.*)?$/);
          const reason = match ? match[1].trim() : "No reason provided";
          return (
            <Tooltip title={`Reason: ${reason}`} placement="top">
              <span><StatusLabel label={label} color={color} /></span>
            </Tooltip>
          );
        }

        return <StatusLabel label={label} color={color} />;
      },
    }
  ];

  const [selectedId, setSelectedId] = React.useState<string>();
  const { params, changePage } = useQueryContext();

  const adminListRentalsResponse = useReadTransaction(adminListRentals, {
    ...params,
    ...member && { memberId: member.id }
  }, !canManage);
  const listRentalsResponse = useReadTransaction(listRentals, {}, canManage, "rentals-list");

  const { isRequesting, data: rentals = [], response, refresh, error } = canManage
    ? adminListRentalsResponse
    : listRentalsResponse;

  const onRenew  = React.useCallback(() => { refresh(); }, [refresh]);
  const onEdit   = React.useCallback(() => { refresh(); setSelectedId(null); }, [refresh]);
  const onDelete = React.useCallback(() => { refresh(); changePage(0); setSelectedId(null); }, [refresh, changePage]);

  const selectedRental = rentals.find(rental => rental.id === selectedId);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12 }} md={member ? 12 : 10}>
        {canManage && (
          <Grid>
            <CreateRentalAdmin onCreate={onRenew} member={member} />
            <EditRental rental={selectedRental} onUpdate={onEdit} />
            <RenewRental rental={selectedRental} onRenew={onRenew} />
            {isAdmin && (
              <DeleteRentalModal rental={selectedRental} onDelete={onDelete} />
            )}
          </Grid>
        )}

        <StatefulTable
          id="rentals-table" title="Rentals"
          loading={isRequesting} data={Object.values(rentals)} error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId} setSelectedIds={setSelectedId}
          columns={fields} rowId={rowId} renderSearch={true}
        />
      </Grid>
    </Grid>
  );
};

export default withQueryContext(RentalsList);
