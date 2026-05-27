import * as React from "react";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import { InputProps } from "./types";
import { FormField } from "../FormField";
import ErrorMessage from "ui/common/ErrorMessage";

export const HostedInput = ({ 
  label, 
  fieldName, 
  placeholder,
  required,
  disabled,
  ...props
}: InputProps<any>): JSX.Element => {
  return (
    <FormField
      fieldName={fieldName}
      required={!!required}
      {...props}
    >
      {(value, onChange, error) => (
        <>
        <FormControl
          fullWidth
          required
          >
          <FormLabel>
            {label} 
          </FormLabel>
          <div 
            id={fieldName}
            className="hosted-field"
          ></div>
        </FormControl>
        {error && <ErrorMessage error={error}/>}
        </>
      )}
    </FormField>
  );
};
