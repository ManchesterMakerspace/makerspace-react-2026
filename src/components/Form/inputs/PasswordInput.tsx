import * as React from "react";

import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Visibility from "@mui/icons-material/Visibility";
import { FormField } from "../FormField";
import { InputProps } from "./types";
import { useFormValues } from "components/Form/FormContext";
import { scorePassword, validatePassword } from "ui/utils/password";

interface Props extends InputProps<string> {
  autoComplete?: string;
}

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["#f44336", "#ff9800", "#ffeb3b", "#8bc34a", "#4caf50"];

export const PasswordInput = ({
  label,
  fieldName,
  placeholder,
  disabled,
  ...props
}: Props): JSX.Element => {
  const values = useFormValues();
  const [mask, setMask] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const toggleMask = React.useCallback(() => setMask(curr => !curr), [setMask]);

  const strength = scorePassword(password);
  const validate = React.useCallback(
    (value: string) => validatePassword(value, Object.entries(values).filter(([key]) => key !== fieldName).map(([, v]) => v)),
    [values, fieldName]
  );

  return (
    <FormField
      fieldName={fieldName}
      required={true}
      validate={validate}
      {...props}
    >
      {(value, onChange, error) => (
        <>
          <TextField
            fullWidth
            required
            value={value}
            onChange={(e) => {
              setPassword(e.target.value);
              onChange(e as React.ChangeEvent<HTMLInputElement>);
            }}
            label={label}
            name={fieldName}
            error={!!error}
            disabled={!!disabled}
            id={fieldName}
            placeholder={placeholder}
            type={mask ? "password" : "text"}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    {mask ?
                      <Visibility style={{ cursor: "pointer" }} onClick={toggleMask} /> :
                      <VisibilityOff style={{ cursor: "pointer" }} onClick={toggleMask} />
                    }
                  </InputAdornment>
                ),
              },
            }}
          />
          {value && (
            <>
              <LinearProgress
                variant="determinate"
                value={(strength / 4) * 100}
                style={{ marginTop: 8, backgroundColor: "#e0e0e0" }}
              />
              <span style={{ color: strengthColor[strength], marginTop: 4, display: "block", fontSize: "0.75rem" }}>
                {strengthLabel[strength]}
              </span>
            </>
          )}
        </>
      )}
    </FormField>
  );
}
