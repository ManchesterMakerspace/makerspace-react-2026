import * as React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import CheckoutRoster from "./CheckoutRoster";
import ShopManager from "./ShopManager";
import ToolManager from "./ToolManager";
import CheckoutApproversManager from "./CheckoutApproversManager";
import { useAuthState } from "ui/reducer/hooks";
import { memberIsResourceManager } from "ui/member/utils";
import { useCapabilities } from "app/permissions";

type TabKey = "roster" | "shops" | "tools" | "approvers";

const ToolCheckoutsPage: React.FC = () => {
  const { currentUser } = useAuthState();
  const isRM = memberIsResourceManager(currentUser);
  const caps = useCapabilities();
  const [activeTab, setActiveTab] = React.useState<TabKey>("roster");

  const tabs: { key: TabKey; label: string; adminOnly?: boolean }[] = [
    { key: "roster", label: "Checkout Roster" },
    { key: "shops", label: "Shops" },
    { key: "tools", label: "Tools" },
    { key: "approvers", label: "Approvers", adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || caps.canManageCheckoutApprovers);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid item md={10} xs={12}>
        <Typography variant="h5" gutterBottom>Tool Checkouts</Typography>
        <Typography variant="body2" color="textSecondary">
          Manage member tool checkouts, shops, tools, and checkout approvers.
          Members can be checked out via the portal or via Slack slash command in the shop channel.
        </Typography>
      </Grid>
      <Grid item md={10} xs={12}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val as TabKey)}
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
      <Grid item md={10} xs={12}>
        {activeTab === "roster" && <CheckoutRoster isAdmin={caps.canManageCheckouts} isResourceManager={isRM} />}
        {activeTab === "shops" && <ShopManager />}
        {activeTab === "tools" && <ToolManager />}
        {activeTab === "approvers" && caps.canManageCheckoutApprovers && <CheckoutApproversManager />}
      </Grid>
    </Grid>
  );
};

export default ToolCheckoutsPage;
