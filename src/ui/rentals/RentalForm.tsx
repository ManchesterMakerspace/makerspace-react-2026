import * as React from "react";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormLabel from "@mui/material/FormLabel";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

import { Rental } from "makerspace-ts-api-client";

import FormModal from "ui/common/FormModal";
import { fields } from "ui/rentals/constants";
import Form from "ui/common/Form";
import { toDatePicker } from "ui/utils/timeToDate";
import MemberSearchInput from "../common/MemberSearchInput";

interface OwnProps {
  rental?: Rental;
  isOpen: boolean;
  isRequesting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (form: Form) => void;
  title?: string;
}

class RentalForm extends React.Component<OwnProps, { contractOnFile: boolean }> {
  public formRef: Form;
  private setFormRef = (ref: Form) => this.formRef = ref;

  public constructor(props: OwnProps) {
    super(props);
    this.state = {
      contractOnFile: props.rental && props.rental.contractOnFile || false
    }
  }

  public componentDidMount(): void {
    this.setState({ contractOnFile: this.props.rental && this.props.rental.contractOnFile || false })
  }

  private toggleContract = () => this.setState(state => ({
    contractOnFile: !state.contractOnFile
  }))

  public validate = (form: Form): Promise<Rental> => form.simpleValidate<Rental>(fields(this.props.rental));

  public render(): JSX.Element {
    const { title, isOpen, onClose, isRequesting, error, onSubmit, rental = {} as Rental } = this.props;

    const rentalFields = fields(rental);

    return isOpen && (
      <FormModal
        formRef={this.setFormRef}
        id="rental-form"
        loading={isRequesting}
        isOpen={isOpen}
        closeHandler={onClose}
        title={title || "Update Rental"}
        onSubmit={onSubmit}
        submitText="Submit"
        error={error}
      >
        <Grid container spacing={3}>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              required
              value={rental.number}
              label={rentalFields.number.label}
              name={rentalFields.number.name}
              id={rentalFields.number.name}
              placeholder={rentalFields.number.placeholder}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              value={rental.description}
              label={rentalFields.description.label}
              name={rentalFields.description.name}
              id={rentalFields.description.name}
              placeholder={rentalFields.description.placeholder}
            />
          </Grid>
          {rental && rental.id && (
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                value={toDatePicker(rental.expiration)}
                label={rentalFields.expiration.label}
                name={rentalFields.expiration.name}
                placeholder={rentalFields.expiration.placeholder}
                type="date"
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <FormLabel component="legend">{rentalFields.memberId.label}</FormLabel>
            <MemberSearchInput
              name={rentalFields.memberId.name}
              placeholder={rentalFields.memberId.placeholder}
              getFormRef={() => this.formRef}
              excludeExpired={true}
              initialSelection={rental && { value: rental.memberId, label: rental.memberName, id: rental.memberId }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormLabel component="legend">{rentalFields.notes.label}</FormLabel>
            <TextField
              name={rentalFields.notes.name}
              value={rental && rental.notes}
              fullWidth
              multiline
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  required={!(rental && rental.id)}
                  name={rentalFields.contractOnFile.name}
                  id={rentalFields.contractOnFile.name}
                  value={rentalFields.contractOnFile.name}
                  checked={this.state.contractOnFile}
                  onChange={this.toggleContract}
                  
                />
              }
              label={rentalFields.contractOnFile.label}
            />
          </Grid>
        </Grid>
      </FormModal>
    )
  }
}

export default RentalForm;
