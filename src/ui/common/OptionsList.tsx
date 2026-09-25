// @ts-nocheck
import * as React from "react";
import Select from "@mui/material/Select";
import { ApiFunction } from "../hooks/types";
import { SelectOption } from "./AsyncSelect";
import useReadTransaction from "../hooks/useReadTransaction";
import Form from "ui/common/Form";

interface Props<Args, Data> {
  apiFunction: ApiFunction<Args, Data[]>;
  args: Args;
  initialValue: string;
  placeholder: string;
  fieldname: string;
  mapOption: (resource: Data) => SelectOption;
  // Optional client-side reorder of the fetched list (e.g. active before hidden).
  sortOptions?: (resources: Data[]) => Data[];
  onChange?: (value: string) => void;
  getFormRef?: () => Form;
}

const OptionsList: React.FC<Props<unknown, unknown>> = ({
  fieldname,
  placeholder,
  initialValue,
  args,
  apiFunction,
  mapOption,
  sortOptions,
  onChange,
  getFormRef
}) => {
  // Capture onChange to update Form if defined
  const internalOnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const form = getFormRef && getFormRef();
    const value = event.currentTarget.value;
    if (form) {
      form.setValue(fieldname, value);
      form.setError(fieldname, undefined);
    }
    onChange && onChange(value);
  };

  const { isRequesting, error, data: fetched = [] } = useReadTransaction(apiFunction, args);
  const data = React.useMemo(() => (sortOptions ? sortOptions(fetched) : fetched), [fetched, sortOptions]);

  return (
    <Select
      onChange={internalOnChange}
      name={fieldname}
      id={fieldname}
      value={initialValue}
      disabled={!data.length}
      fullWidth
      required
      native
      placeholder={placeholder}
    >
      {[
        <option id={`${fieldname}-option-none`} key="none" value={null}>
          {isRequesting ? "Loading..." : error ? "Error loading options" : data.length ? "None" : "No options"}
        </option>,
        [
          ...(data.length
            ? data.map(resource => <option {...mapOption(resource)} key={mapOption(resource).value} />)
            : [])
        ]
      ]}
    </Select>
  );
};

export default function <Args, Data>(props: Props<Args, Data>): React.ReactElement<Props<Args, Data>> {
  return <OptionsList {...props} />;
};
