import * as React from "react";
import Button from "@mui/material/Button";
import { Member } from "makerspace-ts-api-client";
import { Routing } from "app/constants";
import CheckoutRoster from "ui/toolCheckouts/CheckoutRoster";
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
  const isOwnProfile = currentUser.id === member.id;

  return (
    <>
      {isOwnProfile && (
        <Button
          href={Routing.ToolCheckouts}
          variant="contained"
          color="primary"
          style={{ marginBottom: 16 }}
        >
          Request Checkout
        </Button>
      )}
      <CheckoutRoster
        preselectedMember={{ id: member.id, name: `${member.firstname} ${member.lastname}` }}
        isAdmin={caps.canManageCheckouts}
        isResourceManager={isRM}
      />
    </>
  );
};

export default MemberCheckoutsTab;
