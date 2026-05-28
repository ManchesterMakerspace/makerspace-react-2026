import * as React from "react";
import { useNavigate } from 'react-router-dom';
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";

import { InvoiceOption } from "makerspace-ts-api-client";
import { buildNewMemberProfileRoute } from "ui/member/utils";
import { useAuthState } from "ui/reducer/hooks";
import { ToastStatus, useToastContext } from "components/Toast/Toast";
import { Routing } from "app/constants";
import { MembershipSelectForm } from "../MembershipOptions/MembershipSelectForm";
import { noneInvoiceOption, prepaidInvoiceOption } from "../MembershipOptions";
import DuplicateMembershipModal from "ui/membership/DuplicateMembershipModal";

interface Props {}

export const MembershipSelectStep: React.FC<Props & { children?: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const { create } = useToastContext();

  const onSubmit = React.useCallback(async (invoiceOption: InvoiceOption) => {
    const isNoneOption = invoiceOption?.id === noneInvoiceOption.id;
    if (isNoneOption) {
      create({
        status: ToastStatus.Info,
        message: (
          <>
            <Typography component="span" variant="body1">Select a membership anytime in </Typography>
            <Link
              href={Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUser.id)}
              target="_blank"
            >
              <Typography component="span" variant="body1">settings</Typography>
            </Link>
          </>
        )
      });

      navigate(buildNewMemberProfileRoute(currentUser.id));
      return;
    };
    return true;
  }, []);

  return (
    <>
      <MembershipSelectForm onSubmit={onSubmit}>
        {children}
      </MembershipSelectForm>
      <DuplicateMembershipModal />
    </>
  );
};
