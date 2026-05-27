import * as React from "react";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

interface Props {
  label: string;
  id: string;
}
const HostedInput: React.FC<Props> = (props) => {
  return (
    <FormControl
      fullWidth
      required
      >
      <FormLabel>
        {props.label} 
      </FormLabel>
      <div 
        id={props.id}
        className="hosted-field"
      ></div>
    </FormControl>
  )
}

export default HostedInput;