import * as React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import AdminCurrentRentals  from "ui/admin/rentals/AdminCurrentRentals";
import AdminRentalRequests  from "ui/admin/rentals/AdminRentalRequests";
import AdminRentalSpots     from "ui/admin/rentals/AdminRentalSpots";
import AdminRentalTypes     from "ui/admin/rentals/AdminRentalTypes";

type TabKey = "current" | "requests" | "spots" | "types";

const TABS: { key: TabKey; label: string }[] = [
  { key: "current",  label: "Current Rentals" },
  { key: "requests", label: "Rental Requests" },
  { key: "spots",    label: "Rental Spots" },
  { key: "types",    label: "Rental Types" },
];

const AdminRentalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabKey>("current");

  const renderTab = () => {
    switch (activeTab) {
      case "current":  return <AdminCurrentRentals />;
      case "requests": return <AdminRentalRequests />;
      case "spots":    return <AdminRentalSpots />;
      case "types":    return <AdminRentalTypes />;
    }
  };

  return (
    <Grid container spacing={3} justify="center">
      <Grid item md={10} xs={12}>
        <Typography variant="h6" gutterBottom>Rental Management</Typography>
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
          {TABS.map(t => <Tab key={t.key} id={"admin-rentals-tab-" + t.key} value={t.key} label={t.label} />)}
        </Tabs>
      </Grid>
      <Grid item md={10} xs={12}>
        {renderTab()}
      </Grid>
    </Grid>
  );
};

export default AdminRentalsPage;
