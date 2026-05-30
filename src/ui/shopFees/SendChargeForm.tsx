import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import FormLabel from "@mui/material/FormLabel";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";

import ErrorMessage from "ui/common/ErrorMessage";
import LoadingOverlay from "ui/common/LoadingOverlay";
import FormModal from "ui/common/FormModal";
import MemberSearchInput from "ui/common/MemberSearchInput";
import { SelectOption } from "ui/common/AsyncSelect";
import { numberAsCurrency } from "ui/utils/numberAsCurrency";

import { ShopFeeItem, ShopFeeLineItem } from "app/entities/shopFee";
import {
  listShopFeeItems,
  adminCreateShopFeeItem,
  adminUpdateShopFeeItem,
  adminCreateShopCharge,
} from "api/shopFees";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";

// ── Previously-used label suggestions (localStorage) ─────────────────────────

const LABEL_STORAGE_KEY = "shopFeeLabels";
const getStoredLabels = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LABEL_STORAGE_KEY) || "[]");
  } catch { return []; }
};
const saveLabel = (label: string) => {
  const existing = getStoredLabels();
  const updated = Array.from(new Set([label, ...existing])).slice(0, 30);
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(updated));
};

// ── Empty line item factory ───────────────────────────────────────────────────

const emptyLine = (): ShopFeeLineItem => ({
  catalogId: undefined,
  name: "",
  description: "",
  unitPrice: 0,
  quantity: 1,
  updateCatalogPrice: false,
  isCustom: true,
  saveToCatalog: false,
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  preselectedMember?: { id: string; name: string };
}

// ── Component ─────────────────────────────────────────────────────────────────

const SendChargeForm: React.FC<Props> = ({ preselectedMember }) => {
  // Member selection — uses existing MemberSearchInput (react-select based)
  const [selectedMember, setSelectedMember] = React.useState<SelectOption | null>(
    preselectedMember
      ? { id: preselectedMember.id, value: preselectedMember.id, label: preselectedMember.name }
      : null
  );

  const onMemberChange = React.useCallback((option: SelectOption) => {
    setSelectedMember(option || null);
  }, []);

  // Invoice label (multi-line only) — native datalist for autocomplete suggestions
  const [invoiceLabel, setInvoiceLabel] = React.useState("");
  const labelSuggestions = React.useMemo(() => getStoredLabels(), []);

  // Line items
  const [lineItems, setLineItems] = React.useState<ShopFeeLineItem[]>([emptyLine()]);

  // Confirm modal + success
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");

  // Catalog data
  const { data: catalogItems = [], refresh: refreshCatalog } = useReadTransaction(
    listShopFeeItems, {}, undefined, "shop-fee-items-send"
  );
  const catalog = catalogItems as ShopFeeItem[];

  // API calls
  const onChargeSuccess = React.useCallback(({ response: res }: any) => {
    setConfirmOpen(false);
    const invoice = res?.data;
    const name = invoice?.name || "Invoice";
    setSuccessMessage(`Invoice "${name}" sent successfully. The member will receive an email notification.`);
    setLineItems([emptyLine()]);
    setInvoiceLabel("");
    if (!preselectedMember) setSelectedMember(null);
  }, [preselectedMember]);

  const { call: sendCharge, isRequesting: sending, error: sendError } =
    useWriteTransaction(adminCreateShopCharge, onChargeSuccess);
  const { call: updateCatalogItem } = useWriteTransaction(adminUpdateShopFeeItem, refreshCatalog);
  const { call: createCatalogItem } = useWriteTransaction(adminCreateShopFeeItem, refreshCatalog);

  // ── Line item helpers ────────────────────────────────────────────────────────

  const updateLine = (index: number, patch: Partial<ShopFeeLineItem>) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const removeLine = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const addLine = () => setLineItems(prev => [...prev, emptyLine()]);

  const selectFromCatalog = (index: number, catalogId: string) => {
    if (!catalogId) {
      updateLine(index, { ...emptyLine() });
      return;
    }
    const catalogItem = catalog.find(c => c.id === catalogId);
    if (!catalogItem) return;
    updateLine(index, {
      catalogId: catalogItem.id,
      name: catalogItem.name,
      description: catalogItem.description || "",
      unitPrice: parseFloat(catalogItem.amount),
      quantity: 1,
      updateCatalogPrice: false,
      isCustom: false,
      saveToCatalog: false,
    });
  };

  const onPriceChange = (index: number, value: string) => {
    const parsed = parseFloat(value);
    updateLine(index, { unitPrice: isNaN(parsed) ? 0 : parsed });
  };

  // ── Computed values ──────────────────────────────────────────────────────────

  const total = lineItems.reduce((sum, l) => sum + (l.unitPrice * l.quantity), 0);
  const isMultiLine = lineItems.length > 1;
  const canSubmit =
    !!selectedMember &&
    lineItems.length > 0 &&
    lineItems.every(l => l.name && l.unitPrice > 0 && l.quantity > 0) &&
    (!isMultiLine || !!invoiceLabel.trim());

  const invoiceName = isMultiLine ? invoiceLabel.trim() : (lineItems[0]?.name || "Shop Charge");
  const invoiceDescription = lineItems
    .map(l => `${l.name} x${l.quantity} @ ${numberAsCurrency(l.unitPrice)}`)
    .join("; ");

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleConfirmAndSend = React.useCallback(async () => {
    if (!selectedMember || !canSubmit) return;

    for (const line of lineItems) {
      if (line.updateCatalogPrice && line.catalogId) {
        updateCatalogItem({ id: line.catalogId, body: { amount: String(line.unitPrice) } as any });
      }
      if (line.saveToCatalog && line.isCustom) {
        createCatalogItem({
          body: { name: line.name, description: line.description, amount: String(line.unitPrice) } as any,
        });
      }
    }

    if (isMultiLine && invoiceLabel) saveLabel(invoiceLabel);

    sendCharge({
      body: {
        memberId: selectedMember.value,
        name: invoiceName,
        description: invoiceDescription,
        amount: total,
        resourceClass: "fee",
        resourceId: selectedMember.value,
        quantity: 1,
        dueDate: new Date().toISOString(),
      },
    });
  }, [
    selectedMember, lineItems, invoiceName, invoiceDescription, total,
    sendCharge, updateCatalogItem, createCatalogItem, invoiceLabel, isMultiLine, canSubmit,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h6">Send Shop Charge</Typography>
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
          Build a one-off invoice from catalog items or custom charges. The member
          will be emailed and can pay from their Invoices tab.
        </Typography>
      </Grid>

      {successMessage && (
        <Grid size={{ xs: 12 }}>
          <Paper style={{ padding: 16, backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7" }}>
            <Typography style={{ color: "#2e7d32" }}>{successMessage}</Typography>
            <Button size="small" style={{ marginTop: 8 }} onClick={() => setSuccessMessage("")}>
              Send Another
            </Button>
          </Paper>
        </Grid>
      )}

      {!successMessage && (
        <>
          {/* Member selection */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormLabel component="legend" style={{ marginBottom: 6 }}>
              Member *
            </FormLabel>
            {preselectedMember ? (
              <Typography variant="body1">
                <strong>{preselectedMember.name}</strong>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  component="span"
                  style={{ marginLeft: 8 }}
                >
                  (pre-filled from member profile)
                </Typography>
              </Typography>
            ) : (
              <MemberSearchInput
                name="charge-member-search"
                placeholder="Search by name or email"
                onChange={onMemberChange}
                initialSelection={selectedMember}
              />
            )}
          </Grid>

          {/* Invoice label — only shown when multiple line items */}
          {isMultiLine && (
            <Grid size={{ xs: 12, md: 6 }}>
              <FormLabel component="legend" style={{ marginBottom: 6 }}>
                Invoice Label *
              </FormLabel>
              {/* Native datalist — browser autocomplete from previously used labels */}
              <input
                list="invoice-label-list"
                value={invoiceLabel}
                onChange={e => setInvoiceLabel(e.target.value)}
                placeholder="e.g. Metal Shop Fees, Wood Shop Tools"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: "1px solid rgba(0,0,0,0.23)",
                  borderRadius: 4,
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              <datalist id="invoice-label-list">
                {labelSuggestions.map(label => (
                  <option key={label} value={label} />
                ))}
              </datalist>
              <Typography variant="caption" color="textSecondary">
                Shown as the invoice name since multiple items are included
              </Typography>
            </Grid>
          )}

          {/* Line items */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" gutterBottom>
              Line Items
            </Typography>

            {lineItems.map((line, index) => {
              const catalogItem = catalog.find(c => c.id === line.catalogId) || null;
              const priceChanged =
                !line.isCustom &&
                catalogItem &&
                parseFloat(catalogItem.amount) !== line.unitPrice &&
                line.unitPrice > 0;

              return (
                <Paper key={index} variant="outlined" style={{ padding: 16, marginBottom: 12 }}>
                  <Grid container spacing={2} alignItems="flex-start">

                    {/* Catalog picker */}
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <FormLabel component="legend" style={{ marginBottom: 6, fontSize: 12 }}>
                        Select from catalog
                      </FormLabel>
                      <Select
                        native
                        fullWidth
                        value={line.catalogId || ""}
                        onChange={e => selectFromCatalog(index, (e.target as HTMLSelectElement).value)}
                      >
                        <option value="">— custom item —</option>
                        {catalog.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({numberAsCurrency(c.amount)})
                          </option>
                        ))}
                      </Select>
                    </Grid>

                    {/* Item name */}
                    <Grid size={{ xs: 10, sm: 5 }}>
                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="Item Name"
                        placeholder="Custom item name"
                        value={line.name}
                        onChange={e => updateLine(index, {
                          name: e.target.value,
                          isCustom: !line.catalogId,
                          catalogId: undefined,
                        })}
                      />
                    </Grid>

                    {/* Remove button */}
                    <Grid size={{ xs: 2 }} style={{ textAlign: "right", paddingTop: 24 }}>
                      {lineItems.length > 1 && (
                        <Tooltip title="Remove line">
                          <IconButton size="small" onClick={() => removeLine(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Grid>

                    {/* Description */}
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Description (optional)"
                        placeholder="Detail shown on invoice"
                        value={line.description}
                        onChange={e => updateLine(index, { description: e.target.value })}
                      />
                    </Grid>

                    {/* Unit price */}
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="Unit Price ($)"
                        type="number"
                        inputProps={{ min: "0.01", step: "0.01" }}
                        value={line.unitPrice || ""}
                        onChange={e => onPriceChange(index, e.target.value)}
                      />
                    </Grid>

                    {/* Quantity */}
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="Qty"
                        type="number"
                        inputProps={{ min: 1, step: 1 }}
                        value={line.quantity}
                        onChange={e => updateLine(index, {
                          quantity: Math.max(1, parseInt(e.target.value) || 1)
                        })}
                      />
                    </Grid>

                    {/* Line total */}
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="body2" color="textSecondary" align="right">
                        Line total:{" "}
                        <strong>{numberAsCurrency(line.unitPrice * line.quantity)}</strong>
                      </Typography>
                    </Grid>

                    {/* Price changed — offer to update catalog */}
                    {priceChanged && (
                      <Grid size={{ xs: 12 }}>
                        <Paper
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#fff8e1",
                            border: "1px solid #ffe082",
                          }}
                          variant="outlined"
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={line.updateCatalogPrice}
                                onChange={e => updateLine(index, { updateCatalogPrice: e.target.checked })}
                                
                              />
                            }
                            label={
                              <Typography variant="caption">
                                Also update catalog price for <strong>{catalogItem?.name}</strong> from{" "}
                                {numberAsCurrency(catalogItem?.amount)} to{" "}
                                {numberAsCurrency(line.unitPrice)}
                              </Typography>
                            }
                          />
                        </Paper>
                      </Grid>
                    )}

                    {/* Custom item — offer to save to catalog */}
                    {line.isCustom && line.name && (
                      <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={line.saveToCatalog}
                              onChange={e => updateLine(index, { saveToCatalog: e.target.checked })}
                              
                            />
                          }
                          label={
                            <Typography variant="caption">
                              Save <strong>{line.name}</strong> to the catalog for future use
                            </Typography>
                          }
                        />
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              );
            })}

            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addLine}
              style={{ marginTop: 4 }}
            >
              Add Another Item
            </Button>
          </Grid>

          {/* Total + send button */}
          <Grid size={{ xs: 12 }}>
            <Divider style={{ marginBottom: 16 }} />
            <Grid container justifyContent="space-between" alignItems="center">
              <div>
                {isMultiLine && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {lineItems.map((l, i) => (
                      <Chip
                        key={i}
                        size="small"
                        label={`${l.name || "Item"} ×${l.quantity}`}
                        variant="outlined"
                      />
                    ))}
                  </div>
                )}
                <Typography variant="h6">Total: {numberAsCurrency(total)}</Typography>
                {selectedMember && (
                  <Typography variant="body2" color="textSecondary">
                    Will be invoiced to <strong>{selectedMember.label}</strong>
                  </Typography>
                )}
              </div>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<SendIcon />}
                disabled={!canSubmit || sending}
                onClick={() => setConfirmOpen(true)}
              >
                Generate Invoice
              </Button>
            </Grid>
            {!canSubmit && selectedMember && (
              <Typography variant="caption" color="error" style={{ marginTop: 4, display: "block" }}>
                {isMultiLine && !invoiceLabel.trim()
                  ? "An invoice label is required when sending multiple items."
                  : "All line items must have a name, price, and quantity."}
              </Typography>
            )}
          </Grid>
        </>
      )}

      {/* Confirm modal */}
      {confirmOpen && (
        <FormModal
          id="confirm-shop-charge"
          isOpen={true}
          title="Confirm Invoice"
          closeHandler={() => setConfirmOpen(false)}
          onSubmit={handleConfirmAndSend}
          submitText="Send Invoice"
          loading={sending}
          error={sendError}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body1" gutterBottom>
                Send the following invoice to <strong>{selectedMember?.label}</strong>?
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" style={{ padding: 12 }}>
                <Typography variant="subtitle2" gutterBottom>{invoiceName}</Typography>
                {lineItems.map((l, i) => (
                  <Grid container justifyContent="space-between" key={i}>
                    <Typography variant="body2">{l.name} ×{l.quantity}</Typography>
                    <Typography variant="body2">
                      {numberAsCurrency(l.unitPrice * l.quantity)}
                    </Typography>
                  </Grid>
                ))}
                <Divider style={{ margin: "8px 0" }} />
                <Grid container justifyContent="space-between">
                  <Typography variant="subtitle2">Total</Typography>
                  <Typography variant="subtitle2">{numberAsCurrency(total)}</Typography>
                </Grid>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="textSecondary">
                The member will receive an email notification and can pay from their
                Invoices tab using their card on file.
              </Typography>
            </Grid>
            {lineItems.some(l => l.updateCatalogPrice) && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" style={{ color: "#e65100" }}>
                  ⚠ Catalog prices will be updated for:{" "}
                  {lineItems.filter(l => l.updateCatalogPrice).map(l => l.name).join(", ")}
                </Typography>
              </Grid>
            )}
            {lineItems.some(l => l.saveToCatalog) && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" style={{ color: "#1565c0" }}>
                  ✓ New catalog items will be saved:{" "}
                  {lineItems.filter(l => l.saveToCatalog).map(l => l.name).join(", ")}
                </Typography>
              </Grid>
            )}
          </Grid>
        </FormModal>
      )}
    </Grid>
  );
};

export default SendChargeForm;
