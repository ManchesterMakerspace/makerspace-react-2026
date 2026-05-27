import * as React from "react";
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthState } from "../reducer/hooks";
import { buildProfileRouting } from "../member/utils";
import { MembershipAgreement } from "./MembershipAgreement";
import RentalAgreement from "./RentalAgreement";
import { useScrollToHeader } from "ui/hooks/useScrollToHeader";

const resources = ["membership", "rental"];

const AgreementContainer: React.FC = () => {
  const { resource, resourceId } = useParams<{ resource: string; resourceId: string }>();
  const navigate = useNavigate();
  const { currentUser: { id } } = useAuthState();

  React.useEffect(() => {
    if (!resources.includes(resource)) {
      navigate(buildProfileRouting(id));
    }
  }, []);
  
  const { executeScroll } = useScrollToHeader();
  const onSuccess = React.useCallback(() => {
    executeScroll();
    navigate(buildProfileRouting(id));
  }, [history, id, executeScroll]);

  return (
    resource === "membership" ? 
      <MembershipAgreement onSuccess={onSuccess}/>
      : <RentalAgreement rentalId={resourceId} />
  );
};

export default AgreementContainer;
