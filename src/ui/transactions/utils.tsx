import * as React from "react";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import { Transaction, TransactionStatusEnum } from "makerspace-ts-api-client";

export const renderTransactionStatus = (transaction: Transaction) => {
  let label = "Pending";
  let color = Status.Info;
  switch (transaction.status) {
    case TransactionStatusEnum.Settled:
      color = Status.Success;
      label = "Successful";
      break;
    case "submitted_for_settlement" as TransactionStatusEnum:
      color = Status.Warn;
      label = "Pending";
      break;
    case TransactionStatusEnum.Failed:
    case TransactionStatusEnum.ProcessorDeclined:
    case TransactionStatusEnum.SettlementDeclined:
    case TransactionStatusEnum.GatewayRejected:
    case TransactionStatusEnum.Voided:
      color = Status.Danger;
      label = "Failed";
      break;
    default:
      color = Status.Warn;
      label = "Unknown";
      break;
  }

  return (
    <StatusLabel label={label} color={color}/>
  );
}

export const getTransactionDescription = (transaction: Transaction) => {
  let description = "";
  if (transaction.refundedTransactionId) {
    description +=  "Refund"
  } else if (transaction.subscriptionId) {
    description += "Subscription Payment"
  } else {
    description += "Standard Payment"
  }

  if (transaction.invoice) {
    description += ` for ${transaction.invoice.name}`;
  }

  return description;
}

type CsvValue = string | number | null | undefined;

const sumColumn = (data: Array<CsvValue[]>, index: number) => {
  return data.reduce((total, row) => {
    return total + (Number(row[index]) || 0);
  }, 0);  
}

const titleRows = [
  ["Manchester Makerspace Transaction Report"],
]

const headerRow = [
  "ID",
  "Customer ID",
  "Member Name",
  "Date",
  "Amount",
  "Status",
  "Gateway Rejection Reason",
  "Invoice Name",
  "Invoice Resource Class",
];

const numDiscountColumns = 2;
const amountColumn = 4;

export const escapeCsvValue = (value: CsvValue) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const serializeCsvRows = (rows: CsvValue[][]) =>
  rows.map(row => row.map(escapeCsvValue).join(",")).join("\r\n");

export const buildTransactionReport = (transactions: Transaction[]) => {
  let maxDiscounts = 0;

  const transactionRows = transactions.map((transaction) => {
    const numDiscounts = transaction.discounts?.length || 0;

    if (numDiscounts > maxDiscounts) {
      maxDiscounts = numDiscounts;
    }

    return [
      transaction.id,
      transaction.customerDetails?.id,
      transaction.memberName,
      new Date(transaction.createdAt).toLocaleString(),
      transaction.amount,
      transaction.status,
      transaction.gatewayRejectionReason,
      transaction.invoice?.name,
      transaction.invoice?.resourceClass,
      ...(numDiscounts ? transaction.discounts.reduce<CsvValue[]>((discountColumns, discount) => {
        return [
          ...discountColumns,
          discount.name,
          discount.amount
        ];
      }, []) : [])
    ];
  });

  const maxDiscountArray = new Array(maxDiscounts * numDiscountColumns).fill(undefined);

  const rows: CsvValue[][] = [
    titleRows[0],
    ["Date Run:", new Date().toLocaleString()],
    [],
    [...headerRow, ...maxDiscounts ? maxDiscountArray.map((_, index) => {
      const discountColumn = Math.round((index + 1) / numDiscountColumns);
      
      if (index % 2) {
        return `Discount ${discountColumn} Amount`
      }

      return `Discount ${discountColumn} Name`
    }): []],
    ...transactionRows.map(row => [
      ...row,
      ...new Array(maxDiscounts * numDiscountColumns - (row.length - headerRow.length)).fill(undefined),
    ]),
    [],
    ["TOTAL:", ...new Array(amountColumn - 1).fill(undefined), sumColumn(transactionRows, amountColumn),
      ...(maxDiscounts ? maxDiscountArray.map((_, index) => {
        if (index % 2) {
          return sumColumn(transactionRows, headerRow.length + index);
        }
        return "";
      }) : [])]
  ];

  return `${serializeCsvRows(rows)}\r\n`;
};

export const writeReport = (transactions: Transaction[], reportName: string) => {
  const csv = buildTransactionReport(transactions);

  const hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  hiddenElement.target = '_blank';  
    
  //provide the name for the CSV file to be downloaded  
  const date = new Date();
  hiddenElement.download = `${reportName}_${date.getMonth() + 1}_${date.getDate()}_${date.getFullYear()}.csv`;
  hiddenElement.click();  
}
