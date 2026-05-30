import * as React from "react";
import { ActionMeta, OnChangeValue } from "react-select";
import AsyncSelect from "react-select/async";
import Creatable from "react-select/creatable";
import AsyncCreatable from "react-select/async-creatable";
import { AsyncProps } from "react-select/async";
import { CreatableProps } from "react-select/creatable";

import { formDialogClass } from "ui/common/FormModal";
import Form from "ui/common/Form";

export type SelectOption = { label: string, value: string, id?: string };

interface Props {
  name: string;
  createable?: boolean;
  getFormRef?: () => Form;
}

export type AsyncSelectProps<OptionType> = AsyncProps<OptionType, false> & Props;
export type CreateableSelectProps<OptionType> = CreatableProps<OptionType, false> & Props;
export type AsyncCreateableSelectProps<OptionType> = AsyncSelectProps<OptionType> & CreateableSelectProps<OptionType>;

function ModifiedSelect<OptionType>(props: any) {
  const { element: Element, getFormRef, name, ...rest } = props;

  const onChange = (option: OnChangeValue<OptionType, false>, action: ActionMeta<OptionType>) => {
    const form = getFormRef && getFormRef();
    if (form) {
      form.setValue(name, option);
      form.setError(name, undefined);
    }
    if (rest.onChange) rest.onChange(option, action);
  };

  const formDialog = document.getElementsByClassName(formDialogClass)[0];
  const modifiedProps = {
    ...rest,
    name,
    ...(formDialog && { menuPortalTarget: formDialog as HTMLElement }),
    onChange,
  };

  return <Element {...modifiedProps} />;
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
