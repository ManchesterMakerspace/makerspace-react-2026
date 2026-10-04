import * as React from "react";
import TextField from "@mui/material/TextField";
import { FormField } from "../FormField";
import { InputProps } from "./types";

export const formatPostalCode = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 9);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  // Allow the separator while ZIP+4 is being entered; validation still requires four trailing digits.
  return digits.length === 5 && value.endsWith("-") ? `${digits}-` : digits;
};

const validatePostalCode = (value: string) => !value || /^[0-9]{5}(-[0-9]{4})?$/.test(value)
  ? undefined : "Enter a 5-digit ZIP code or ZIP+4 (#####-####).";

export const PostalCodeInput = ({ label, fieldName, placeholder, required, disabled, ...props }: InputProps<string>): JSX.Element => (
  <FormField {...props} fieldName={fieldName} required={!!required} validate={validatePostalCode}>
    {(value, onChange, error) => (
      <TextField fullWidth type="text" value={value} error={!!error}
        onChange={event => {
          event.target.value = formatPostalCode(event.target.value);
          onChange(event as React.ChangeEvent<HTMLInputElement>);
        }}
        required={!!required} disabled={!!disabled} label={label} name={fieldName} id={fieldName}
        placeholder={placeholder} autoComplete="postal-code"
        helperText="5 digits or ZIP+4 (e.g. 03101-1234)"
        slotProps={{ htmlInput: {
          inputMode: "numeric", maxLength: 10, pattern: "[0-9]{5}(-[0-9]{4})?",
          "aria-describedby": `${fieldName}-helper-text${error ? ` ${fieldName}-error` : ""}`,
        } }} />
    )}
  </FormField>
);
