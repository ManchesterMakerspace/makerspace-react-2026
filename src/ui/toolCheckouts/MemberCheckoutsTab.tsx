import * as React from "react";
import { Member } from "makerspace-ts-api-client";
import CheckoutRoster from "ui/toolCheckouts/CheckoutRoster";
import ToolCheckoutRequests from "ui/toolCheckouts/ToolCheckoutRequests";
import { useAuthState } from "ui/reducer/hooks";
import { memberIsResourceManager } from "ui/member/utils";
import { useCapabilities } from "app/permissions";

interface Props {
  member: Member;
}

const MemberCheckoutsTab: React.FC<Props> = ({ member }) => {
  const { currentUser } = useAuthState();
  const isRM = memberIsResourceManager(currentUser);
  const caps = useCapabilities();
  const isOwnProfile = currentUser?.id === member.id;

  return (
    <>
      {isOwnProfile && <ToolCheckoutRequests showMemberActions />}
      <CheckoutRoster
        preselectedMember={{ id: member.id, name: `${member.firstname} ${member.lastname}` }}
        isAdmin={caps.canManageCheckouts}
        isResourceManager={isRM}
      />
    </>
  );
};

export default MemberCheckoutsTab;
