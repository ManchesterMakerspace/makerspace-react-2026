import * as React from "react";

import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Visibility from "@mui/icons-material/Visibility";
import { FormField } from "../FormField";
import { InputProps } from "./types";
import { useFormValues } from "../FormContext";
import { PasswordStrength, PasswordStrengthProfile, validatePasswordStrength } from "./PasswordStrength";

interface PasswordProfileFieldNames {
  firstname?: string;
  lastname?: string;
  city?: string;
  address?: string;
  email?: string;
}

interface Props extends InputProps<string> {
  autoComplete?: string;
  passwordProfile?: PasswordStrengthProfile;
  passwordProfileFieldNames?: PasswordProfileFieldNames;
}

export const PasswordInput = ({ 
  label, 
  fieldName, 
  placeholder,
  disabled,
  passwordProfile,
  passwordProfileFieldNames,
  validate,
  ...props
}: Props): JSX.Element => {
  const [mask, setMask] = React.useState(true);
  const values = useFormValues();
  const toggleMask = React.useCallback(() => setMask(curr => !curr), [setMask]);

  const profile = React.useMemo<PasswordStrengthProfile>(() => ({
    ...passwordProfile,
    firstname: passwordProfile?.firstname || (passwordProfileFieldNames?.firstname ? values[passwordProfileFieldNames.firstname] as string : undefined),
    lastname: passwordProfile?.lastname || (passwordProfileFieldNames?.lastname ? values[passwordProfileFieldNames.lastname] as string : undefined),
    city: passwordProfile?.city || (passwordProfileFieldNames?.city ? values[passwordProfileFieldNames.city] as string : undefined),
    address: passwordProfile?.address || (passwordProfileFieldNames?.address ? values[passwordProfileFieldNames.address] as string : undefined),
    email: passwordProfile?.email || (passwordProfileFieldNames?.email ? values[passwordProfileFieldNames.email] as string : undefined),
  }), [passwordProfile, passwordProfileFieldNames, values]);

  const validatePassword = React.useCallback((value: string) => {
    const strengthError = validatePasswordStrength(value, profile);
    return strengthError || validate?.(value);
  }, [profile, validate]);

  return (
    <FormField
      fieldName={fieldName}
      required={true}
      validate={validatePassword}
      {...props}
    >
      {(value, onChange, error) => (
        <>
          <TextField
            fullWidth
            required
            value={value}
            onChange={(e) => {
              onChange(e as React.ChangeEvent<HTMLInputElement>);
            }}
            label={label}
            name={fieldName}
            error={!!error}
            disabled={!!disabled}
            id={fieldName}
            placeholder={placeholder}
            type={mask ? 'password' : 'text'}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    {mask ? 
                      <Visibility style={{cursor: 'pointer'}} onClick={toggleMask} /> :
                      <VisibilityOff style={{cursor: 'pointer'}} onClick={toggleMask} />
                    }
                  </InputAdornment>
                ),
              },
            }}
          />
          <PasswordStrength password={value as string} profile={profile} />
        </>
      )}
    </FormField>
  )
}
