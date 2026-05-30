import * as React from "react";
import { useNavigate } from 'react-router-dom';
import { Member } from "makerspace-ts-api-client";
import { ActionButton } from "ui/common/ButtonRow";
import { Routing } from "app/constants";

interface Props {
  member: Member;
}

const ChargeButton: React.FC<Props> = ({ member }) => {
  const navigate = useNavigate();

  const handleClick = React.useCallback(() => {
    const params = new URLSearchParams({
      memberId: member.id,
      memberName: `${member.firstname} ${member.lastname}`,
    });
    navigate(`${Routing.ShopFees}?${params.toString()}`);
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
