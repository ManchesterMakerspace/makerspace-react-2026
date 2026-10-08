import * as React from "react";
import { Navigate, useParams } from "react-router-dom";
import { clearCheckoutDestination } from "ui/auth/checkoutDestination";

// Where an approver lands after signing in from the public tool page's
// "Approver? Sign in to check out a member" link. It shows that tool's Workshops
// entry and opens the Check Out Member dialog there, when the viewer may check
// members out on it (otherwise they simply see the tool).
const CheckoutMemberLinkPage: React.FC = () => {
  const { id } = useParams();
  React.useEffect(() => { clearCheckoutDestination(); }, []);
  return <Navigate replace to={`/workshops?tool=${encodeURIComponent(id || "")}&checkout=member`} />;
};

export default CheckoutMemberLinkPage;
