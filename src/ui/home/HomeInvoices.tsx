import * as React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, Paper, Stack, Typography } from "@mui/material";
import { Invoice, listInvoices } from "makerspace-ts-api-client";
import { Routing, Whitelists } from "app/constants";
import { InvoiceableResourceDisplay } from "app/entities/invoice";
import { useAuthState } from "ui/reducer/hooks";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { useAddToCart, useEmptyCart } from "ui/checkout/cart";
import InvoiceDetails from "ui/invoice/InvoiceDetails";
import { isInvoicePayable, renderInvoiceDueDate, renderInvoiceStatus } from "ui/invoice/utils";
import { numberAsCurrency } from "ui/utils/numberAsCurrency";
import extractTotalItems from "ui/utils/extractTotalItems";

const HomeInvoices: React.FC = () => {
  const { currentUser, permissions } = useAuthState();
  const navigate = useNavigate();
  const emptyCart = useEmptyCart();
  const addToCart = useAddToCart();
  const [pageNum, setPageNum] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(0);
  const [selected, setSelected] = React.useState<Invoice>();
  // Always the self-service endpoint, including when staff open their own Home.
  const { data = [], response, isRequesting, error, refresh } = useReadTransaction(listInvoices,
    { settled: false, orderBy: "due_date", order: "asc", pageNum }, false, "home-invoices", true, true);
  const total = extractTotalItems(response) || 0;
  React.useEffect(() => {
    if (!isRequesting && !error && response) {
      if (pageNum === 0 && data.length) setPageSize(data.length);
      if (pageNum > 0 && !data.length) setPageNum(0);
    }
  }, [response, isRequesting, error, pageNum, data.length]);

  const pay = (invoice: Invoice) => {
    emptyCart();
    addToCart(invoice);
    navigate(Routing.Checkout);
  };

  return <Paper component="section" aria-labelledby="home-invoices-title" sx={{ p: { xs: 2, sm: 3 } }}>
    <Typography id="home-invoices-title" component="h2" variant="h5" gutterBottom>Open unpaid invoices</Typography>
    {isRequesting ? <CircularProgress aria-label="Loading unpaid invoices" /> : error ?
      <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Retry invoices</Button>}>{error}</Alert>
      : !data.length ? <Typography>No unpaid invoices</Typography> : <>
        <List disablePadding>
          {data.map(invoice => <ListItem key={invoice.id} disableGutters divider sx={{ py: 2, display: "block" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h3" variant="h6">{invoice.name || InvoiceableResourceDisplay[invoice.resourceClass] || "Invoice"}</Typography>
                <Typography variant="body2">{InvoiceableResourceDisplay[invoice.resourceClass] || invoice.resourceClass} · {numberAsCurrency(invoice.amount)}</Typography>
                <Typography variant="body2">{renderInvoiceDueDate(invoice)} · {renderInvoiceStatus(invoice)}</Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1 }}>
                {permissions[Whitelists.billing] && (invoice.subscriptionId ?
                  <Button component={RouterLink as React.ElementType} to={`/members/${currentUser.id}/settings/subscriptions`}>Manage Subscription</Button>
                  : isInvoicePayable(invoice) && <Button variant="contained" onClick={() => pay(invoice)}
                    aria-label={`Pay invoice ${invoice.name || invoice.id}`}>Pay</Button>)}
                <Button variant="outlined" onClick={() => setSelected(invoice)} aria-label={`View invoice ${invoice.name || invoice.id}`}>View</Button>
              </Stack>
            </Stack>
          </ListItem>)}
        </List>
        {(pageNum > 0 || total > data.length) && <Stack component="nav" aria-label="Invoice pages" direction="row" spacing={2} sx={{ mt: 2, alignItems: "center" }}>
          <Button disabled={pageNum === 0} onClick={() => setPageNum(page => page - 1)}>Previous</Button>
          <Typography>Page {pageNum + 1}</Typography>
          <Button disabled={!pageSize || pageNum * pageSize + data.length >= total} onClick={() => setPageNum(page => page + 1)}>Next</Button>
        </Stack>}
      </>}
    <Dialog open={!!selected} onClose={() => setSelected(undefined)} aria-labelledby="home-invoice-details-title" fullWidth maxWidth="sm">
      <DialogTitle id="home-invoice-details-title">Invoice details</DialogTitle>
      <DialogContent>{selected && <InvoiceDetails invoice={selected} />}</DialogContent>
      <DialogActions><Button onClick={() => setSelected(undefined)}>Close</Button></DialogActions>
    </Dialog>
  </Paper>;
};

export default HomeInvoices;
