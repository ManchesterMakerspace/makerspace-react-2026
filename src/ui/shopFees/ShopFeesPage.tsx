import * as React from "react";
import { useLocation } from 'react-router-dom';
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import SendChargeForm from "./SendChargeForm";
import FeeCatalog from "./FeeCatalog";

// Query param key used when navigating here from a member profile
const MEMBER_ID_PARAM = "memberId";
const MEMBER_NAME_PARAM = "memberName";

type TabKey = "send" | "catalog";

const TABS: { key: TabKey; label: string }[] = [
  { key: "send", label: "Send Charge" },
  { key: "catalog", label: "Fee Catalog" },
];

const ShopFeesPage: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const preselectedMemberId = searchParams.get(MEMBER_ID_PARAM);
  const preselectedMemberName = searchParams.get(MEMBER_NAME_PARAM);

  // If arriving from a member profile, default to the Send tab
  const [activeTab, setActiveTab] = React.useState<TabKey>(
    preselectedMemberId ? "send" : "send"
  );

  const preselectedMember = preselectedMemberId && preselectedMemberName
    ? { id: preselectedMemberId, name: preselectedMemberName }
    : undefined;

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid item md={10} xs={12}>
        <Typography variant="h5" gutterBottom>
          Shop Fees
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Send one-off charges to members for tool replacements, parts, materials,
          or other shop costs. Members pay via their card on file from the Invoices tab.
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
          {TABS.map(t => (
            <Tab
              key={t.key}
              id={`shop-fees-tab-${t.key}`}
              value={t.key}
              label={t.label}
            />
          ))}
        </Tabs>
      </Grid>

      <Grid item md={10} xs={12}>
        {activeTab === "send" && (
          <SendChargeForm preselectedMember={preselectedMember} />
        )}
        {activeTab === "catalog" && <FeeCatalog />}
      </Grid>
    </Grid>
  );
};

export default ShopFeesPage;
