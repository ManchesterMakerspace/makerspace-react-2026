import * as React from "react";

import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Visibility from "@mui/icons-material/Visibility";
import { FormField } from "../FormField";
import { InputProps } from "./types";

interface Props extends InputProps<string> {
  autoComplete?: string;
}

const scorePassword = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["#f44336", "#ff9800", "#ffeb3b", "#8bc34a", "#4caf50"];

export const PasswordInput = ({ 
  label, 
  fieldName, 
  placeholder,
  disabled,
  ...props
}: Props): JSX.Element => {
  const [mask, setMask] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const toggleMask = React.useCallback(() => setMask(curr => !curr), [setMask]);

  const strength = scorePassword(password);

  return (
    <FormField
      fieldName={fieldName}
      required={true}
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
            type={mask ? 'password' : 'text'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {mask ? 
                    <Visibility style={{cursor: 'pointer'}} onClick={toggleMask} /> :
                    <VisibilityOff style={{cursor: 'pointer'}} onClick={toggleMask} />
                  }
                </InputAdornment>
              ),
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
  )
}
