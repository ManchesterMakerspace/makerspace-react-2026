import * as React from "react";
import useReactRouter from "use-react-router";
import { Member } from "makerspace-ts-api-client";
import { ActionButton } from "ui/common/ButtonRow";
import { Routing } from "app/constants";

interface Props {
  member: Member;
}

const ChargeButton: React.FC<Props> = ({ member }) => {
  const { history } = useReactRouter();

  const handleClick = React.useCallback(() => {
    const params = new URLSearchParams({
      memberId: member.id,
      memberName: `${member.firstname} ${member.lastname}`,
    });
    history.push(`${Routing.ShopFees}?${params.toString()}`);
  }, [member, history]);

  return (
    <ActionButton
      id="member-detail-charge-member"
      key="charge-member"
      color="secondary"
      variant="outlined"
      label="Shop Fee"
      onClick={handleClick}
    />
  );
};

export default ChargeButton;
