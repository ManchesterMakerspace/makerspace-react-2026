import * as React from "react";
import AwesomeDebouncePromise from 'awesome-debounce-promise';

import { listMembers, isApiErrorResponse, getMember, message, MemberStatus } from "makerspace-ts-api-client";
import { SelectOption, AsyncSelectFixed, AsyncCreatableSelect, AsyncSelectProps, AsyncCreateableSelectProps } from "./AsyncSelect";
import Form from "./Form";
import { searchCheckoutMembers } from "api/toolCheckouts";
import useWriteTransaction from "ui/hooks/useWriteTransaction";

interface Props  {
  name: string;
  placeholder?: string;
  creatable?: boolean;
  initialSelection?: SelectOption;
  disabled?: boolean;
  excludeIds?: string[];    // Exclude specific member IDs e.g. current user in EM reports
  fullyActiveUnexpired?: boolean; // Filter in Mongo before search pagination
  excludeExpired?: boolean; // Exclude members with expired or inactive/revoked status
  onChange?(selection: SelectOption): void;
  getFormRef?(): Form;
}

async function searchMemberOptions(
  searchValue: string,
  excludeIds: string[] = [],
  excludeExpired: boolean = false,
  fullyActiveUnexpired: boolean = false
) {
  const membersResponse = fullyActiveUnexpired
    ? await searchCheckoutMembers(searchValue)
    : await listMembers({ search: searchValue });
  let memberOptions = [] as SelectOption[];
  if (isApiErrorResponse(membersResponse)) {
    console.error(membersResponse.error);
    message({ body: { message: JSON.stringify(membersResponse.error) }})
  } else {
    const members = membersResponse.data;
    memberOptions = members
      .filter(member => {
        // Filter out explicitly excluded IDs
        if (excludeIds.includes(member.id)) return false;
        // Filter out expired/inactive/revoked members if requested
        if (excludeExpired) {
          const isActiveStatus = member.status === MemberStatus.ActiveMember;
          const isNotExpired = member.expirationTime && member.expirationTime > Date.now();
          if (!isActiveStatus || !isNotExpired) return false;
        }
        return true;
      })
      .map(member => ({
        value: member.id,
        label: `${member.firstname} ${member.lastname}`,
        id: member.id
      }));
  }
  return memberOptions;
}

type MemberSearchComponent = React.FunctionComponent<AsyncSelectProps<SelectOption> | AsyncCreateableSelectProps<SelectOption>>;

const MemberSearchInput: React.FC<Props> = ({
  creatable,
  disabled,
  name,
  onChange,
  getFormRef,
  placeholder,
  initialSelection,
  excludeIds = [],
  excludeExpired = false,
  fullyActiveUnexpired = false,
}) => {
  // Track field value
  const [selection, setSelection] = React.useState<SelectOption>(initialSelection);
  const componentRef = React.useRef<MemberSearchComponent>(creatable ? AsyncCreatableSelect : AsyncSelectFixed);

  // Pass a new callback when filters change; mutating a ref after render leaves
  // AsyncSelect using the previous search policy until another render occurs.
  const loadMembers = React.useMemo(
    () => AwesomeDebouncePromise(
      (search: string) => searchMemberOptions(search, excludeIds, excludeExpired, fullyActiveUnexpired),
      250
    ),
    [JSON.stringify(excludeIds), excludeExpired, fullyActiveUnexpired]
  );

  // Determine select component
  React.useEffect(() => {
    if (!componentRef.current) {
      componentRef.current = creatable ? AsyncCreatableSelect : AsyncSelectFixed;
    }
  }, [creatable]);

  React.useEffect(() => {
    getFormRef && selection && getFormRef().setValue(name, selection);
  }, [getFormRef, name, JSON.stringify(selection)]);

  React.useEffect(() => {
    initialSelection && setSelection(initialSelection);
  }, [setSelection, JSON.stringify(initialSelection)]);

  const { call: reportError } = useWriteTransaction(message);

  // Fetch initial member option
  React.useEffect(() => {
    const fetchMember = async () => {
      if (selection) {
        const response = await getMember({ id: selection.value });
        if (isApiErrorResponse(response)) {
          console.error(response.error);
          reportError({ body: { message: JSON.stringify(response.error) }});
        } else {
          const member = response.data;
          setSelection({
            value: member.id,
            label: `${member.firstname} ${member.lastname}`,
            id: member.id
          });
        }
      }
    }

    initialSelection && initialSelection.value && fetchMember();
  }, [JSON.stringify(initialSelection), setSelection, reportError]);

  const updateSelection = React.useCallback((newSelection: SelectOption) => {
    setSelection(newSelection);
    onChange && onChange(newSelection);
  }, [onChange, setSelection]);

  return (
    <componentRef.current
      isClearable
      name={name}
      id={name}
      value={selection && selection.value ? selection : undefined}
      placeholder={placeholder}
      onChange={updateSelection}
      isDisabled={disabled}
      loadOptions={loadMembers}
      getFormRef={getFormRef}
    />
  )
};

export default MemberSearchInput;
