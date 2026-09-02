import { Transaction } from "makerspace-ts-api-client";
import { buildTransactionReport, escapeCsvValue } from "ui/transactions/utils";

describe("transaction CSV reports", () => {
  it("escapes commas, quotes, and line breaks", () => {
    expect(escapeCsvValue('Acme, "North"\nShop')).toBe('"Acme, ""North""\nShop"');
  });

  it("includes transaction, customer, status, rejection, and invoice fields with CRLF rows", () => {
    const transaction = {
      id: "transaction-1",
      customerDetails: { id: "customer-1" },
      memberName: 'Doe, "Jane"',
      createdAt: "2026-01-02T03:04:05.000Z",
      amount: "12.34",
      status: "gateway_rejected",
      gatewayRejectionReason: "risk_threshold",
      invoice: { name: "Laser, large", resourceClass: "Rental" },
      discounts: [],
    } as unknown as Transaction;

    const report = buildTransactionReport([transaction]);

    expect(report).toContain('"ID","Customer ID","Member Name","Date","Amount","Status","Gateway Rejection Reason","Invoice Name","Invoice Resource Class"\r\n');
    expect(report).toContain('"transaction-1","customer-1","Doe, ""Jane"""');
    expect(report).toContain('"gateway_rejected","risk_threshold","Laser, large","Rental"');
    expect(report.endsWith("\r\n")).toBe(true);
    expect(report.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
