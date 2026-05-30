import * as React from "react";
import { useParams } from 'react-router-dom';
import Grid from "@mui/material/Grid2";
import Button from "@mui/material/Button";

import { Report, listEarnedMembershipReports, getMember, getEarnedMembership, adminGetEarnedMembership, adminListEarnedMembershipReports } from "makerspace-ts-api-client";

import { SortDirection } from "ui/common/table/constants";
import { timeToDate } from "ui/utils/timeToDate";
import { ReportForm } from "ui/reports/ReportForm";
import CreateReport from "./CreateReport";
import useReadTransaction from "../hooks/useReadTransaction";
import extractTotalItems from "../utils/extractTotalItems";
import useModal from "../hooks/useModal";
import { useAuthState } from "../reducer/hooks";
import { useCapabilities } from "app/permissions";
import StatefulTable from "../common/table/StatefulTable";
import { withQueryContext, useQueryContext } from "../common/Filters/QueryContext";

const getFields = (openDetails: (id: string) => void) => ([
  {
    id: "date",
    label: "Created",
    cell: (row: Report) => timeToDate(row.date),
    defaultSortDirection: SortDirection.Desc
  },
  {
    id: "view",
    label: "",
    cell: (row: Report) => <Button onClick={() => openDetails(row.id)}>View Report</Button>
  },
]);

const rowId = (report: Report) => report.id;

const ReportsTable: React.FC<{ earnedMembershipId: string }> = ({ earnedMembershipId }) => {
  const [selectedId, setSelectedId] = React.useState<string>();

  const { params, changePage } = useQueryContext();
  const { isOpen, openModal, closeModal } = useModal();
  const { currentUser: { id: currentUserId } } = useAuthState();
  const { canManageEarnedMemberships } = useCapabilities();
  const { memberId } = useParams();
  const isOwnMembership = currentUserId === memberId;
  const asAdmin = canManageEarnedMemberships && !isOwnMembership

  const setSeleted = React.useCallback((ids: string[]) => {
    setSelectedId(Array.isArray(ids) && ids[0] || undefined);
  }, [setSelectedId]);
  const {
    data: member
  } = useReadTransaction(getMember, { id: memberId });
  const {
    data: earnedMembership
  } = useReadTransaction(asAdmin ? adminGetEarnedMembership : getEarnedMembership, { id: earnedMembershipId});

  const adminEMResponse = useReadTransaction(adminListEarnedMembershipReports, { id: earnedMembershipId, ...params }, !asAdmin);
  const emResponse = useReadTransaction(listEarnedMembershipReports, { id: earnedMembershipId, ...params }, asAdmin);
  const {
    isRequesting,
    error,
    data: reports = [],
    response,
    refresh,
  } = asAdmin ? adminEMResponse : emResponse;


  const onCreate = React.useCallback(() => {
    refresh();
    changePage(0);
  }, [refresh, changePage])

  const openDetails = React.useCallback(reportId => {
    setSelectedId(reportId);
    openModal();
  }, [openModal, setSelectedId]);


  const selectedReport = reports.find(report => selectedId === report.id);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12 }} md={memberId ? 12 : 10}>
        {isOwnMembership && <CreateReport onCreate={onCreate} />}
        <StatefulTable
          id="membership-reports-table"
          title="Earned Membership Reports"
          loading={isRequesting}
          data={Object.values(reports)}
          error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={[selectedId]}
          setSelectedIds={setSeleted}
          columns={getFields(openDetails)}
          rowId={rowId}
        />
        {isOpen && (
          <ReportForm
            membership={earnedMembership}
            member={member}
            report={selectedReport}
            isOpen={true}
            isRequesting={isRequesting}
            error={error}
            onClose={closeModal}
            disabled={true}
          />
        )}
      </Grid>
    </Grid>
  )
}

export default withQueryContext(ReportsTable);
