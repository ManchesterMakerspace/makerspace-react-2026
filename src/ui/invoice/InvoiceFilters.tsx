import * as React from "react";
import Grid from "@mui/material/Grid2";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import RadioGroup from "@mui/material/RadioGroup";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { useQueryContext } from "../common/Filters/QueryContext";
import { withFilterButton } from "../common/FilterButton";

const InvoiceFilters: React.FC<{ close: () => void, onChange: () => void }> = ({ close, onChange }) => {
  const { params, setParam } = useQueryContext();

  const toggleRadio = React.useCallback(
    (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      let param;
      if (value === "true") {
        param = true;
      } else if (value === "false") {
        param = false;
      }
      setParam(key, param);
      onChange();
      close();
    }, [setParam, onChange, close]);

  const paramToVal = (param: any) => {
    return param === true ? "true" : param === false ? "false" : "both"
  }

  const onSearch = React.useCallback((event: React.KeyboardEvent<EventTarget>) => {
    if (event.key === "Enter") {
      const searchTerm = (event.target as HTMLInputElement).value;
      setParam("search", searchTerm);
      onChange();
      close();
    }
  }, [setParam, onChange, close]);

  return (
    <>
      <Typography variant="subtitle1" gutterBottom>
        Invoice Filters
      </Typography>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Search for dues</FormLabel>
          <TextField id="invoice-search-input" type="text" placeholder="Search..." onKeyPress={onSearch} />
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Past Due</FormLabel>
          <RadioGroup name="pastDue" value={paramToVal(params.pastDue)} onChange={toggleRadio("pastDue")}>
            <FormControlLabel value="true" control={<Radio />} label="Past Due" />
            <FormControlLabel value="false" control={<Radio />} label="Not Past Due" />
            <FormControlLabel value="both" control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Refunded</FormLabel>
          <RadioGroup name="refunded" value={paramToVal(params.refunded)} onChange={toggleRadio("refunded")}>
            <FormControlLabel value="true" control={<Radio />} label="Refunded" />
            <FormControlLabel value="false" control={<Radio />} label="Not Refunded" />
            <FormControlLabel value="both" control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Refund Requested</FormLabel>
          <RadioGroup
            name="refundRequested"
            value={paramToVal(params.refundRequested)}
            onChange={toggleRadio("refundRequested")}
          >
            <FormControlLabel value="true" control={<Radio />} label="Requested" />
            <FormControlLabel value="false" control={<Radio />} label="Not Requestedd" />
            <FormControlLabel value="both" control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Orphaned</FormLabel>
          <RadioGroup name="orphaned" value={paramToVal(params.orphaned)} onChange={toggleRadio("orphaned")}>
            <FormControlLabel value="true" control={<Radio />} label="Orphaned Only" />
            <FormControlLabel value="both" control={<Radio />} label="All" />
          </RadioGroup>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12 }} style={{ marginBottom: "1em" }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Filter by Paid</FormLabel>
          <RadioGroup name="settled" value={paramToVal(params.settled)} onChange={toggleRadio("settled")}>
            <FormControlLabel value="true" control={<Radio />} label="Paid" />
            <FormControlLabel value="false" control={<Radio />} label="Unpaid" />
            <FormControlLabel value="both" control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Grid>
    </>
  );

};

export default withFilterButton(InvoiceFilters);
