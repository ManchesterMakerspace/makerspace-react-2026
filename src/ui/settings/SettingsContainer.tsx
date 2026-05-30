import * as React from "react";
import { useParams } from 'react-router-dom';

import Grid from "@mui/material/Grid2";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";

import PaymentMethodsContainer from "ui/checkout/PaymentMethodsContainer";
import { Whitelists } from "app/constants";
import { useAuthState } from "../reducer/hooks";
import EditMember from "ui/member/EditMember";
import SecuritySettings from "ui/settings/SecuritySettings";
import { getMember, Member } from "makerspace-ts-api-client";
import useReadTransaction from "ui/hooks/useReadTransaction";
import LoadingOverlay from "ui/common/LoadingOverlay";
import SubscriptionSettings from "ui/settings/SubscriptionSettings";
import useSubresourcePath from "ui/hooks/useSubresourcePath";

export enum SubRoutes {
  Profile = "profile",
  Subscriptions = "subscriptions",
  PaymentMethods = "payment-methods",
  Security = "security",
}

const SettingsContainer: React.FC = () => {
  const { currentUser: { id: currentUserId }, permissions } = useAuthState();
  const billingEnabled = !!permissions[Whitelists.billing];
  const { memberId: routeMemberId, resource } = useParams<{ memberId: string, resource: string }>();
  const targetMemberId = routeMemberId || currentUserId;

  const [selectedIndex, setIndex] = React.useState(0);
  const {
    isRequesting: loadingMember,
    data: member = { id: targetMemberId } as Member,
  } = useReadTransaction(getMember, { id: targetMemberId });
  const changeResource = useSubresourcePath(Object.values(SubRoutes));
  React.useEffect(() => {
    switch(resource) {
      case SubRoutes.Subscriptions:
        setIndex(1);
        break;
      case SubRoutes.PaymentMethods:
        setIndex(2);
        break;
      case SubRoutes.Security:
        setIndex(3);
        break;
      default:
        setIndex(0);
    }
  }, [resource]);

  const onSelectItem = React.useCallback((index: number, route: string) => () => {
    setIndex(index);
    changeResource(route);
  }, [setIndex, changeResource]);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 5, md: 4 }}>
        <List component="nav">
          <ListItemButton selected={selectedIndex === 0} onClick={onSelectItem(0, "profile")}>
            <ListItemText id="settings-profile" primary="Personal Information" />
          </ListItemButton>
          {billingEnabled && (
            <>
              <ListItemButton selected={selectedIndex === 1} onClick={onSelectItem(1, "subscriptions")}>
                <ListItemText id="settings-membership" primary="Subscriptions" />
              </ListItemButton>
              <ListItemButton selected={selectedIndex === 2} onClick={onSelectItem(2, "payment-methods")}>
                <ListItemText id="settings-payment-methods" primary="Payment Methods" />
              </ListItemButton>
            </>
          )}
          <ListItemButton selected={selectedIndex === 3} onClick={onSelectItem(3, "security")}>
            <ListItemText id="settings-security" primary="Security" />
          </ListItemButton>
        </List>
      </Grid>
      <Grid size={{ xs: 12, sm: 7, md: 8 }}>
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                {selectedIndex === 0 && (
                  <>
                    {loadingMember && <LoadingOverlay id="settings-loading" />}
                    <EditMember formOnly={true} member={member} />
                  </>
                )}
                {selectedIndex === 1 && (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <SubscriptionSettings />
                    </Grid>
                  </Grid>
                )}
                {selectedIndex === 2 && (
                  <PaymentMethodsContainer title="Manage Payment Methods" managingMethods={true} />
                )}
                {selectedIndex === 3 && (
                  <SecuritySettings memberId={targetMemberId} memberEmail={member.email} />
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default SettingsContainer;
