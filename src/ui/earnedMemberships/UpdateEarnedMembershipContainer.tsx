import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { State as ReduxState, ScopedThunkDispatch } from 'ui/reducer';
import { Member, EarnedMembership, NewEarnedMembership } from 'makerspace-ts-api-client';
import { CrudOperation } from 'app/constants';
import Form from 'ui/common/Form';
import EarnedMembershipForm from 'ui/earnedMemberships/EarnedMembershipForm';
import { createMembershipAction, updateMembershipAction } from 'ui/earnedMemberships/actions';

export interface UpdateMembershipRenderProps {
  membership: Partial<EarnedMembership>;
  member?: Partial<Member>;
  isOpen: boolean;
  operation: CrudOperation;
  closeHandler: () => void;
  isRequesting: boolean;
  error: string;
  submit: (form: Form) => Promise<void>;
  setRef: (ref: EarnedMembershipForm) => void;
}

interface OwnProps {
  membership: Partial<EarnedMembership>;
  member?: Partial<Member>;
  isOpen: boolean;
  operation: CrudOperation;
  closeHandler: () => void;
  render: (renderPayload: UpdateMembershipRenderProps) => JSX.Element;
}

const UpdateEarnedMembershipContainer: React.FC<OwnProps> = ({
  membership, member, isOpen, operation, closeHandler, render
}) => {
  const dispatch = useDispatch<ScopedThunkDispatch>();
  const formRef = React.useRef<EarnedMembershipForm>(null);

  const { isRequesting, error } = useSelector((state: ReduxState) => {
    switch (operation) {
      case CrudOperation.Update: return state.earnedMemberships.update;
      case CrudOperation.Create: return state.earnedMemberships.create;
      default: return { isRequesting: false, error: undefined };
    }
  });

  const prevIsRequestingRef = React.useRef(isRequesting);
  React.useEffect(() => {
    const wasRequesting = prevIsRequestingRef.current;
    prevIsRequestingRef.current = isRequesting;
    if (isOpen && wasRequesting && !isRequesting && !error) {
      closeHandler();
    }
  }, [isRequesting]);

  const dispatchMembership = (membershipDetails: NewEarnedMembership) => {
    let action;
    switch (operation) {
      case CrudOperation.Update:
        const currentRequirementNames = membership.requirements.map(req => req.name);
        const mergedRequirements = membershipDetails.requirements.reduce((requirements, requirement) => {
          const reqIndex = currentRequirementNames.indexOf(requirement.name);
          if (reqIndex > -1) {
            requirements[reqIndex] = { ...membership.requirements[reqIndex], ...requirement };
          } else {
            requirements.push(requirement);
          }
          return requirements;
        }, []);
        action = updateMembershipAction(membership.id, {
          ...membershipDetails as EarnedMembership,
          requirements: mergedRequirements,
        });
        break;
      case CrudOperation.Create:
        action = createMembershipAction(membershipDetails);
        break;
    }
    return dispatch(action);
  };

  const submit = async (form: Form) => {
    const validUpdate: NewEarnedMembership = await formRef.current?.validate(form);
    if (!form.isValid()) {
      const errors = document.querySelectorAll('[id$="-error"]');
      errors[0] && (errors[0] as HTMLElement).focus();
      return;
    }
    return await dispatchMembership(validUpdate);
  };

  const setRef = (ref: EarnedMembershipForm) => {
    (formRef as React.MutableRefObject<any>).current = ref;
  };

  return render({ membership, member, isOpen, operation, closeHandler, isRequesting, error, submit, setRef });
};

export default UpdateEarnedMembershipContainer;
