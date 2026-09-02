import * as React from "react";

import { Transaction } from "makerspace-ts-api-client";
import FormModal from "ui/common/FormModal";
import KeyValueItem from "ui/common/KeyValueItem";
import { timeToDate } from "ui/utils/timeToDate";
import { numberAsCurrency } from "ui/utils/numberAsCurrency";
import { useCapabilities } from "app/permissions";
import { ActionButton } from "../common/ButtonRow";
import useModal from "../hooks/useModal";
import { getTransactionDescription } from "./utils";
import { DocumentInternalFrame } from "../documents/Document";
import { buildReceiptUrl } from "../checkout/Receipt";

interface OwnProps {
  transaction: Transaction;
}

const ViewTransactionModal: React.FC<OwnProps> = ({ transaction = {} as Transaction }) => {
  const { canRefundTransactions: isAdmin } = useCapabilities();
  const { isOpen, openModal, closeModal } = useModal();

  return (
    <>
      <ActionButton
        label="View Transaction"
        id={"transactions-list-view"}
        variant={"outlined"}
        color={"secondary"}
        onClick={openModal}
      />
      {isOpen && (
        <FormModal
          id="refund-transaction"
          isOpen={isOpen}
          closeHandler={closeModal}
          title={getTransactionDescription(transaction)}
        >
          <KeyValueItem label="Transaction ID">
            <span id="view-transaction-id">{transaction.id}</span>
          </KeyValueItem>
          {transaction.customerDetails?.id && <KeyValueItem label="Customer ID">
            <span id="view-transaction-customer-id">{transaction.customerDetails.id}</span>
          </KeyValueItem>}
          <KeyValueItem label="Status">
            <span id="view-transaction-status">{transaction.status}</span>
          </KeyValueItem>
          {transaction.gatewayRejectionReason && <KeyValueItem label="Gateway Rejection Reason">
            <span id="view-transaction-gateway-rejection-reason">{transaction.gatewayRejectionReason}</span>
          </KeyValueItem>}
          {transaction.invoice?.name && <KeyValueItem label="Invoice Name">
            <span id="view-transaction-invoice-name">{transaction.invoice.name}</span>
          </KeyValueItem>}
          {transaction.invoice?.resourceClass && <KeyValueItem label="Invoice Resource Class">
            <span id="view-transaction-invoice-resource-class">{transaction.invoice.resourceClass}</span>
          </KeyValueItem>}
          {transaction.invoice ?
            <DocumentInternalFrame id="view-transaction-frame" style={{ width: "100%" }} src={buildReceiptUrl(transaction.invoice.id, isAdmin)} />
          : (<>
              <KeyValueItem label="Date">
                <span id="refund-transaction-date">{timeToDate(transaction.createdAt)}</span>
              </KeyValueItem>
              <KeyValueItem label="Amount">
                <span id="refund-transaction-amount">{numberAsCurrency(Number(transaction.amount) - Number(transaction.discountAmount))}</span>
              </KeyValueItem>
              { isAdmin && transaction.memberName &&
                <KeyValueItem label="Member">
                  <span id="refund-transaction-member">{transaction.memberName}</span>
                </KeyValueItem>}
            </>)}
        </FormModal>
      )}
    </>
  )
}

export default ViewTransactionModal;
