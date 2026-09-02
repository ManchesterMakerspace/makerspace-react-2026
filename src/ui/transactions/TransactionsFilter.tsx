import * as React from "react";
import Grid from "@mui/material/Grid";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import FormGroup from "@mui/material/FormGroup";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

import { useQueryContext } from "../common/Filters/QueryContext";
import { withFilterButton } from "../common/FilterButton";
import { toDatePicker, dateToMidnight } from "../utils/timeToDate";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { isApiErrorResponse, listBillingDiscounts } from "makerspace-ts-api-client";

export const transactionStatuses = {
  authorizing: {
    label: "Authorizing",
    value: "Authorizing"
  },
  authorized: {
    label: "Authorized",
    value: "Authorized"
  },
  authorizationExpired: {
    label: "Authorization Expired",
    value: "AuthorizationExpired"
  },
  submittedForSettlement: {
    label: "Submitted For Settlement",
    value: "SubmittedForSettlement"
  },
  settling: {
    label: "Settling",
    value: "Settling"
  },
  settlementPending: {
    label: "SettlementPending",
    value: "SettlementPending"
  },
  settlementDeclined: {
    label: "SettlementDeclined",
    value: "SettlementDeclined"
  },
  settled: {
    label: "Settled",
    value: "Settled"
  },
  voided: {
    label: "Voided",
    value: "Voided"
  },
  processorDeclined: {
    label: "ProcessorDeclined",
    value: "ProcessorDeclined"
  },
  gatewayRejected: {
    label: "GatewayRejected",
    value: "GatewayRejected"
  },
  failed: {
    label: "Failed",
    value: "Failed"
  },
}

const TransactionFilters: React.FC<{ close: () => void, onChange: () => void }> = ({ close, onChange }) => {
  const { params, setParam } = useQueryContext();
  const [dateDrafts, setDateDrafts] = React.useState(() => ({
    startDate: toDatePicker(params.startDate) || "",
    endDate: toDatePicker(params.endDate) || "",
  }));
  const keyboardEditingDate = React.useRef({ startDate: false, endDate: false });

  const setType =  React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setParam("type", event.target.value);
      onChange();
      close();
    }, [setParam, onChange, close]);


  const toggleRefunded = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      let param;
      if (value === "true") {
        param = true;
      } else if (value === "false") {
        param = false;
      }
      setParam("refund", param);
      if (!params.type) {
        setParam("type", "Sale");
      }
      onChange();
      close();
    }, [setParam, onChange, close, params]);

  const applyDate = React.useCallback((param: "startDate" | "endDate", value: string) => {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setParam(param, dateToMidnight(value));
    onChange();
    close();
  }, [setParam, onChange, close]);

  const onDateChange = React.useCallback((param: "startDate" | "endDate") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setDateDrafts(current => ({ ...current, [param]: value }));
    if (!keyboardEditingDate.current[param]) applyDate(param, value);
  }, [applyDate]);

  const onDateKeyDown = React.useCallback((param: "startDate" | "endDate") => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      applyDate(param, event.currentTarget.value);
    } else if (event.key !== "Tab" && event.key !== "Escape") {
      keyboardEditingDate.current[param] = true;
    }
  }, [applyDate]);

  const onDatePointerDown = React.useCallback((param: "startDate" | "endDate") => () => {
    keyboardEditingDate.current[param] = false;
  }, []);

  const onCheckboxChange = React.useCallback((param: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.currentTarget;
    setParam(param, ((curr: string[]) => {
      if (checked) {
        return [...curr, value];
      } else {
        const updated = curr.slice();
        const valIndex = updated.indexOf(value);
        if (valIndex > -1) {
          updated.splice(valIndex, 1);
        }
        return updated;
      }
    }));
    onChange();
    close();
  }, [setParam, onChange, close]);

  const onNumberChange = React.useCallback((param: "minAmount" | "maxAmount" | "limit") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setParam(param, value === "" ? undefined : Number(value));
    onChange();
  }, [setParam, onChange]);

  const {
    response,
  } = useReadTransaction(listBillingDiscounts, { orderBy: "amount" })

  const discounts = !isApiErrorResponse(response) && response?.data || [];

  const paramToVal = (param: any) => {
    return param === true ? "true" : param === false ? "false" : "both"
  }

  return (
    <>
      <Typography variant="subtitle1" gutterBottom>Transaction Filters</Typography>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend">Filter by Dollar Amount</FormLabel>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Minimum amount"
                name="minimum-amount-filter"
                type="number"
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                value={params.minAmount ?? ""}
                onChange={onNumberChange("minAmount")}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Maximum amount"
                name="maximum-amount-filter"
                type="number"
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                value={params.maxAmount ?? ""}
                onChange={onNumberChange("maxAmount")}
              />
            </Grid>
          </Grid>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend">Maximum Transactions Returned</FormLabel>
          <TextField
            name="transaction-limit-filter"
            type="number"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            value={params.limit ?? ""}
            onChange={onNumberChange("limit")}
            helperText="Leave blank to use the default limit."
          />
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Transaction Type</FormLabel>
          <RadioGroup name="settled" value={params.type} onChange={setType}>
            <FormControlLabel value="Sale" control={<Radio />} label="Sale" />
            <FormControlLabel value="Credit" control={<Radio />} label="Credit" />
            <FormControlLabel control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Refunded</FormLabel>
          <RadioGroup name="settled" value={paramToVal(params.refund)} onChange={toggleRefunded}>
            <FormControlLabel value="true" control={<Radio />} label="Refunded" />
            <FormControlLabel value="false" control={<Radio />} label="Not Refunded" />
            <FormControlLabel value="both" control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Transaction Start Due</FormLabel>
          <TextField
              value={dateDrafts.startDate}
              name="start-date-filter"
              id="start-date-filter"
              type="date"
              onChange={onDateChange("startDate")}
              onKeyDown={onDateKeyDown("startDate")}
              onPointerDown={onDatePointerDown("startDate")}
            />
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Transaction End Due</FormLabel>
          <TextField
              value={dateDrafts.endDate}
              name="end-date-filter"
              id="end-date-filter"
              type="date"
              onChange={onDateChange("endDate")}
              onKeyDown={onDateKeyDown("endDate")}
              onPointerDown={onDatePointerDown("endDate")}
            />
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Transaction status</FormLabel>
            <FormGroup>
              {Object.values(transactionStatuses).map(status => (
              <FormControlLabel
                key={status.value}
                control={<Checkbox checked={params.transactionStatus?.includes(status.value)} onChange={onCheckboxChange("transactionStatus")} value={status.value} />}
                label={status.label}
              />
              ))}
          </FormGroup>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Discount</FormLabel>
            <FormGroup>
              {discounts.map(discount => (
              <FormControlLabel
                key={discount.id}
                control={<Checkbox checked={params.discountId?.includes(discount.id)} onChange={onCheckboxChange("discountId")} value={discount.id} />}
                label={discount.name}
              />
              ))}
          </FormGroup>
        </FormControl>
      </Grid>
    </>
  )

};

export default withFilterButton(TransactionFilters);
