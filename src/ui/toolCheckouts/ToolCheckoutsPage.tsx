import * as React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import CheckoutRoster from "./CheckoutRoster";
import ShopManager from "./ShopManager";
import ToolManager from "./ToolManager";
import CheckoutApproversManager from "./CheckoutApproversManager";
import ToolCheckoutRequestsManager from "./ToolCheckoutRequestsManager";
import { useAuthState } from "ui/reducer/hooks";
import { memberIsResourceManager } from "ui/member/utils";
import { useCapabilities } from "app/permissions";

type TabKey = "requests" | "roster" | "shops" | "tools" | "approvers";

const ToolCheckoutsPage: React.FC = () => {
  const { currentUser } = useAuthState();
  const isRM = memberIsResourceManager(currentUser);
  const managesShops = isRM && ((currentUser as any).resourceManagerShopIds || []).length > 0;
  const caps = useCapabilities();
  const defaultTab: TabKey = caps.canManageCheckouts ? "roster" : "requests";
  const [activeTab, setActiveTab] = React.useState<TabKey>(defaultTab);
  const [userSelectedTab, setUserSelectedTab] = React.useState(false);

  React.useEffect(() => {
    if (!userSelectedTab) setActiveTab(defaultTab);
  }, [defaultTab, userSelectedTab]);

  const tabs: { key: TabKey; label: string; adminOnly?: boolean }[] = [
    { key: "requests", label: "Requests" },
    { key: "roster", label: "Checkout Roster", adminOnly: true },
    { key: "shops", label: "Shops", adminOnly: true },
    { key: "tools", label: "Tools", adminOnly: true },
    { key: "approvers", label: "Approvers", adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => {
    if (!t.adminOnly) return true;
    if (t.key === "approvers") return caps.canManageCheckoutApprovers;
    if (t.key === "shops" || t.key === "tools") return managesShops || caps.canManageCheckoutApprovers;
    return caps.canManageCheckouts;
  });

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12, md: 10 }}>
        <Typography variant="h5" gutterBottom>Tool Checkouts</Typography>
        <Typography variant="body2" color="textSecondary">
          Manage and request member tool checkouts.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 10 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => { setUserSelectedTab(true); setActiveTab(val as TabKey); }}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {visibleTabs.map(t => (
            <Tab key={t.key} id={`tool-checkouts-tab-${t.key}`} value={t.key} label={t.label} />
          ))}
        </Tabs>
      </Grid>
      <Grid size={{ xs: 12, md: 10 }}>
        {activeTab === "requests" && <ToolCheckoutRequestsManager canManage={caps.canManageCheckouts} />}
        {activeTab === "roster" && caps.canManageCheckouts && <CheckoutRoster isAdmin={caps.canManageCheckouts} isResourceManager={managesShops} />}
        {activeTab === "shops" && <ShopManager />}
        {activeTab === "tools" && <ToolManager />}
        {activeTab === "approvers" && caps.canManageCheckoutApprovers && <CheckoutApproversManager />}
      </Grid>
    </Grid>
  );
};

export default ToolCheckoutsPage;
