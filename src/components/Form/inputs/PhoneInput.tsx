import * as React from "react";
import TextField from "@mui/material/TextField";
import { FormField } from "../FormField";
import { InputProps } from "./types";

export const PhoneInput = ({ 
  label, 
  fieldName, 
  placeholder,
  required,
  disabled,
  validate,
  ...props
}: InputProps<string>): JSX.Element => {
  const validatePhone = React.useCallback((value: string) => {
    if (value && /[^0-9+() -]/.test(value)) return "Use only numbers 0–9, +, -, (, ), and spaces.";
    return validate?.(value);
  }, [validate]);

  return (
    <FormField
      fieldName={fieldName}
      required={!!required}
      {...props}
      validate={validatePhone}
    >
      {(value, onChange, error) => (
        <TextField
          fullWidth
          value={value}
          onChange={event => {
            event.target.value = event.target.value.replace(/[^0-9+() -]/g, "");
            onChange(event as React.ChangeEvent<HTMLInputElement>);
          }}
          error={!!error}
          required={!!required}
          disabled={!!disabled}
          label={label}
          name={fieldName}
          id={fieldName}
          placeholder={placeholder}
          type="tel"
          autoComplete="tel"
          helperText="Use numbers 0–9, +, -, (, ), and spaces."
          slotProps={{ htmlInput: {
            inputMode: "tel",
            "aria-describedby": `${fieldName}-helper-text${error ? ` ${fieldName}-error` : ""}`,
          } }}
        />
      )}
    </FormField>
  )
}
