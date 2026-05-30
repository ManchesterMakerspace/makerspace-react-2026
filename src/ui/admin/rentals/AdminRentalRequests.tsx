import * as React from "react";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { Link } from "react-router-dom";
import { Rental } from "makerspace-ts-api-client";

import StatefulTable from "ui/common/table/StatefulTable";
import { SortDirection } from "ui/common/table/constants";
import { Column } from "ui/common/table/Table";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import ErrorMessage from "ui/common/ErrorMessage";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { adminListPendingRentals, approveRental, denyRental } from "api/rentals";
import { withQueryContext, useQueryContext } from "ui/common/Filters/QueryContext";
import extractTotalItems from "ui/utils/extractTotalItems";

const rowId = (rental: Rental) => rental.id;
type ActionTarget = { rental: Rental; action: "approve" | "deny" };

const infoBoxStyle: React.CSSProperties = {
  marginTop: "8px", padding: "8px",
  backgroundColor: "#e3f2fd", borderRadius: "4px",
  border: "1px solid #90caf9"
};

const AdminRentalRequests: React.FC = () => {
  const [actionTarget, setActionTarget] = React.useState<ActionTarget | null>(null);
  const [denyReason,   setDenyReason]   = React.useState("");
  const [selectedId,   setSelectedId]   = React.useState<string>(undefined);
  const { changePage } = useQueryContext();

  const { isRequesting, data: rentals = [], response, refresh, error } = useReadTransaction(
    adminListPendingRentals, {}, undefined, "admin-rental-requests"
  );

  const onActionSuccess = React.useCallback(() => {
    setActionTarget(null);
    setDenyReason("");
    setSelectedId(undefined);
    refresh();
    changePage(0);
  }, [refresh, changePage]);

  const { call: doApprove, isRequesting: approving, error: approveError } = useWriteTransaction(approveRental, onActionSuccess);
  const { call: doDeny,    isRequesting: denying,   error: denyError }    = useWriteTransaction(denyRental,   onActionSuccess);
  const isActing = approving || denying;

  const selectedRental = (rentals as Rental[]).find(r => r.id === selectedId);

  const columns: Column<Rental>[] = [
    {
      id: "number", label: "Spot",
      cell: (row: Rental) => row.number,
      defaultSortDirection: SortDirection.Asc,
    },
    {
      id: "member", label: "Member",
      cell: (row: Rental) => <Link to={`/members/${row.memberId}`}>{row.memberName}</Link>,
    },
    {
      id: "description", label: "Description",
      cell: (row: Rental) => row.description || "—",
    },
    {
      id: "notes", label: "Member Notes",
      cell: (row: Rental) => (row as any).notes || "—",
    },
    {
      id: "status", label: "Status",
      cell: () => <StatusLabel label="Pending Approval" color={Status.Warn} />,
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container justifyContent="space-between" alignItems="center" style={{ marginBottom: 8 }}>
          <Typography variant="h6">Pending Rental Requests</Typography>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedRental && (
              <>
                <Button
                  variant="contained" color="primary" disabled={isActing}
                  onClick={() => setActionTarget({ rental: selectedRental, action: "approve" })}
                >
                  Approve
                </Button>
                <Button
                  variant="outlined" color="secondary" disabled={isActing}
                  onClick={() => setActionTarget({ rental: selectedRental, action: "deny" })}
                >
                  Deny
                </Button>
              </>
            )}
          </div>
        </Grid>

        {!isRequesting && (rentals as Rental[]).length === 0 && (
          <Typography color="textSecondary">No pending rental requests.</Typography>
        )}

        <StatefulTable
          id="admin-rental-requests-table"
          title="Pending Rental Requests"
          loading={isRequesting}
          data={Object.values(rentals)}
          error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId}
          setSelectedIds={setSelectedId}
          columns={columns}
          rowId={rowId}
          renderSearch={false}
        />
      </Grid>

      <Dialog open={!!actionTarget} onClose={() => !isActing && setActionTarget(null)}>
        <DialogTitle>
          {actionTarget?.action === "approve" ? "Approve Rental Request" : "Deny Rental Request"}
        </DialogTitle>
        <DialogContent>
          {actionTarget && (
            <>
              <Typography gutterBottom>Member: <strong>{actionTarget.rental.memberName}</strong></Typography>
              <Typography gutterBottom>Spot: <strong>{actionTarget.rental.number}</strong></Typography>
              {(actionTarget.rental as any).notes && (
                <Typography gutterBottom color="textSecondary">
                  Member notes: {(actionTarget.rental as any).notes}
                </Typography>
              )}
              {actionTarget.action === "approve" && (
                <Typography variant="body2" style={infoBoxStyle}>
                  Approving will activate the rental and generate an invoice for the member.
                </Typography>
              )}
              {actionTarget.action === "deny" && (
                <TextField
                  fullWidth multiline rows={3}
                  label="Reason for denial (optional)"
                  placeholder="This will be included in the notification email to the member."
                  value={denyReason}
                  onChange={e => setDenyReason(e.target.value)}
                  variant="outlined"
                  style={{ marginTop: "16px" }}
                />
              )}
              <ErrorMessage error={approveError || denyError} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionTarget(null)} disabled={isActing}>Cancel</Button>
          {actionTarget?.action === "approve" && (
            <Button color="primary" variant="contained" disabled={isActing}
              onClick={() => doApprove({ id: actionTarget.rental.id })}
            >{approving ? "Approving..." : "Approve"}</Button>
          )}
          {actionTarget?.action === "deny" && (
            <Button color="secondary" variant="contained" disabled={isActing}
              onClick={() => doDeny({ id: actionTarget.rental.id, body: { reason: denyReason } })}
            >{denying ? "Denying..." : "Deny"}</Button>
          )}
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default withQueryContext(AdminRentalRequests);
