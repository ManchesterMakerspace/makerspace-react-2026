import * as React from "react";
import { MembershipAgreement } from "ui/documents/MembershipAgreement";

interface Props {
  children?: React.ReactNode;
}

export const AgreementStep: React.FC<Props> = ({ children }) => {
  return (
    <MembershipAgreement hideFooter={true}>{children}</MembershipAgreement>
  );
};
