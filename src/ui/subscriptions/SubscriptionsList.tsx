import * as React from "react";
import { useLocation } from 'react-router-dom';
import Grid from "@mui/material/Grid";
import { Link } from "react-router-dom";

import { Subscription, adminListSubscriptions } from "makerspace-ts-api-client";

import { Column } from "../common/table/Table";
import StatefulTable from "../common/table/StatefulTable";
import { numberAsCurrency } from "../utils/numberAsCurrency";
import { timeToDate } from "../utils/timeToDate";
import extractTotalItems from "../utils/extractTotalItems";
import CancelSubscriptionModal from "./CancelSubscriptionModal";
import useReadTransaction from "../hooks/useReadTransaction";
import { withQueryContext, useQueryContext } from "../common/Filters/QueryContext";
import SubscriptionFilters, { SubscriptionFilter, subscriptionStatuses } from "./SubscriptionFilters";
import { Routing } from "../../app/constants";

const fields: Column<Subscription>[] = [
  {
    id: "memberName",
    label: "Member",
    cell: (row: Subscription) => 
      <Link to={`${Routing.Members}/${row.memberId}`}>{row.memberName}</Link>,
  },
  {
    id: "resourceClass",
    label: "Type",
    cell: (row: Subscription) => row.resourceClass,
  }, {
    id: "amount",
    label: "Amount",
    cell: (row: Subscription) => numberAsCurrency(row.amount),
  }, {
    id: "status",
    label: "Status",
    cell: (row: Subscription) => row.status,
  }, {
    id: "nextBilling",
    label: "Next Billing Date",
    cell: (row: Subscription) => timeToDate(row.nextBillingDate),
  }
];

const rowId = (sub: Subscription) => sub.id;

const SubscriptionsTable: React.FC = () => {
  const { search } = useLocation();
  const [selectedId, setSelectedId] = React.useState<string>();
  const searchTerms = new URLSearchParams(search);

  const { current: searchTerm } = React.useRef(searchTerms.get("q") || undefined)
  const { current: statusTerm } = React.useRef(searchTerms.get(SubscriptionFilter.Status))

  const {
    params: { pageNum, order, orderBy, ...restParams },
    changePage
  } = useQueryContext({
    search: searchTerm,
    startDate: undefined,
    endDate: undefined,
    planId: [],
    subscriptionStatus: [
      ...statusTerm ? [
        statusTerm === "all" ? [] : [statusTerm]
      ] : [subscriptionStatuses.active.value],
    ],
  });

  // Filter out null, undefined, and empty string values before sending to API
  // Prevents issues like search=null being sent when no search term is provided
  const cleanParams = Object.entries(restParams).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  const { isRequesting, data: subscriptions = [], response, refresh, error } = useReadTransaction(
    adminListSubscriptions,
    { ...cleanParams }
  );

  const onCancel = React.useCallback(() => {
    refresh();
    changePage(0);
  }, [refresh, changePage]);

  const selectedSubscription = subscriptions.find(sub => sub.id === selectedId);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12 }}>
        <Grid>
          <CancelSubscriptionModal
            subscription={selectedSubscription || {} as Subscription}
            onSuccess={onCancel}
          />
          <SubscriptionFilters onChange={refresh}/>
        </Grid>

        <StatefulTable
          id="subscriptions-table"
          title="Subscriptions"
          loading={isRequesting}
          data={Object.values(subscriptions)}
          error={error}
          totalItems={extractTotalItems(response)}
          selectedIds={selectedId}
          setSelectedIds={setSelectedId}
          columns={fields}
          rowId={rowId}
        />
      </Grid>
    </Grid>
  )
}

export default withQueryContext(SubscriptionsTable);
