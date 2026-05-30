import * as React from "react";
import AsyncSelect from "react-select/async";
import Creatable from "react-select/creatable";
import AsyncCreatable from "react-select/async-creatable";
import { AsyncProps } from "react-select/async";
import { CreatableProps } from "react-select/creatable";

import { formDialogClass } from "ui/common/FormModal";
import { FormField } from "../FormField";
import { InputProps } from "./types";

interface Props extends Omit<InputProps<any>, "label"> {
  createable?: boolean;
}

export type AsyncSelectProps<OptionType> = AsyncProps<OptionType, false> & Props;
export type CreateableSelectProps<OptionType> = CreatableProps<OptionType, false> & Props;
export type AsyncCreateableSelectProps<OptionType> = AsyncSelectProps<OptionType> & CreateableSelectProps<OptionType>;

function ModifiedSelect<OptionType>(props: any) {
  const { element: Element, fieldName, validate, defaultValue, required, ...rest } = props;

  const formDialog = document.getElementsByClassName(formDialogClass)[0];
  const modifiedProps = {
    ...rest,
    name: fieldName,
    id: fieldName,
    ...(formDialog && { menuPortalTarget: formDialog as HTMLElement }),
  };

  return (
    <FormField
      fieldName={fieldName}
      validate={validate}
      defaultValue={defaultValue || ""}
      required={!!required}
    >
      {(value, onChange, error) => (
        <Element error={error} {...modifiedProps} onChange={onChange} value={value} />
      )}
    </FormField>
  );
}

export function AsyncCreatableSelect<OptionType>(props: AsyncCreateableSelectProps<OptionType>): React.ReactElement {
  return <ModifiedSelect {...props} element={AsyncCreatable} />;
}

export function AsyncSelectFixed<OptionType>(props: AsyncSelectProps<OptionType>): React.ReactElement {
  return <ModifiedSelect {...props} element={AsyncSelect} />;
}

export function CreateableSelect<OptionType>(props: CreateableSelectProps<OptionType>): React.ReactElement {
  return <ModifiedSelect {...props} element={Creatable} />;
}

export default AsyncSelectFixed;
