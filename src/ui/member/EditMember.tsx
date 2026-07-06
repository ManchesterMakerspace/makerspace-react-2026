// @ts-nocheck
import * as React from "react";
import { adminUpdateMember, Member, updateMember } from "makerspace-ts-api-client";
import useWriteTransaction from "../hooks/useWriteTransaction";
import { ActionButton } from "../common/ButtonRow";
import useModal from "../hooks/useModal";
import Form from "../common/Form";
import { useCapabilities } from "app/permissions";
import { useAuthState } from "../reducer/hooks";
import MemberForm from "./MemberForm";
import EmailChangeNoticeModal from "./EmailChangeNoticeModal";


const EditMember: React.FC<{ member: Member, onEdit?: () => void; formOnly?: boolean }> = ({ member = {} as Member, formOnly, onEdit }) => {
  const { isOpen, openModal, closeModal } = useModal();
  const { isOpen: emailNoticeOpen, openModal: openEmailNotice, closeModal: closeEmailNotice } = useModal();
  const { canEditMembers } = useCapabilities();
  const { currentUser: { id: currentUserId } } = useAuthState();
  const isOwnProfile = currentUserId === member.id;
  const formRef = React.useRef<MemberForm>();
  const pendingEmailChange = React.useRef(false);

  const onSuccess = React.useCallback(() => {
    closeModal();
    onEdit && onEdit();
    if (pendingEmailChange.current) {
      pendingEmailChange.current = false;
      openEmailNotice();
    }
  }, [onEdit, closeModal, openEmailNotice]);
  const {
    isRequesting: memberUpdating,
    error: updateError,
    call: update,
  } = useWriteTransaction(canEditMembers ? adminUpdateMember : updateMember, onSuccess);

  const onSubmit = React.useCallback(async (form: Form) => {
    const validUpdate: Record<string, any> = await formRef.current.validate(form);

    if (!form.isValid()) return;

    const { street, unit, city, state, postalCode, ...rest } = validUpdate;

    // Self-service email changes no longer trigger an automatic Slack/Drive
    // invite (see #75) — flag it here so onSuccess can show the manual
    // follow-up notice. Only applies when members edit their own profile;
    // an admin editing another member's profile already knows to handle
    // invites themselves.
    pendingEmailChange.current = isOwnProfile
      && !!rest.email
      && rest.email !== member.email;

    update({ id: member.id, body: {
      ...rest,
      address: {
        street,
        unit,
        city,
        state,
        postalCode
      }
    } });
  }, [formRef, update, isOwnProfile, member.email, member.id]);

  return (
    <>
      {!formOnly && (
        <ActionButton
          id="member-detail-open-edit-modal"
          color="primary"
          variant="outlined"
          disabled={!member.id}
          label="Edit"
          onClick={openModal}
        />
      )}
      {(isOpen || formOnly) && (
        <MemberForm
          ref={formRef}
          member={member}
          isAdmin={canEditMembers}
          isOpen={true}
          isRequesting={memberUpdating}
          error={updateError}
          onClose={closeModal}
          onSubmit={onSubmit}
          noDialog={formOnly}
        />
      )}
      <EmailChangeNoticeModal open={emailNoticeOpen} onClose={closeEmailNotice} />
    </>
  );
}

export default EditMember;
