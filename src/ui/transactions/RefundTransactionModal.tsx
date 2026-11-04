import * as React from "react";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

import { Transaction, TransactionStatusEnum, deleteTransaction, adminDeleteTransaction } from "makerspace-ts-api-client";
import FormModal from "ui/common/FormModal";
import KeyValueItem from "ui/common/KeyValueItem";
import { timeToDate } from "ui/utils/timeToDate";
import { numberAsCurrency } from "ui/utils/numberAsCurrency";
import { useCapabilities } from "app/permissions";
import { ActionButton } from "../common/ButtonRow";
import useModal from "../hooks/useModal";
import useWriteTransaction from "../hooks/useWriteTransaction";

interface OwnProps {
  transaction: Transaction;
  onSuccess: () => void;
}

const RefundTransactionModal: React.FC<OwnProps> = ({ transaction = {} as Transaction, onSuccess }) => {
  const { canRefundTransactions: isAdmin } = useCapabilities();
  const { isOpen, openModal, closeModal } = useModal();

  const title = isAdmin ? "Refund Transaction" : "Request Refund";
  const text = isAdmin ? (
    <span>
        Are you sure you want to refund this transaction?
    </span>
  ) : (
    <span>
      Would you like to request a refund for this transaction?
      <br/>
      An administrator will review the request and notify you of a decision. Please note, requests for refunds are evaluated on a case by case basis and are not guaranteed.
    </span>
  );
  
  // Disable if invoice already refunded or not yet settled
  let disabled: boolean = transaction.status !== TransactionStatusEnum.Settled || // Already settled
                          !!transaction.refundedTransactionId ||  // Already refunded
                          (!isAdmin && !!(transaction.invoice && transaction.invoice.refundRequested)) // Already been requested
  let label: string =  isAdmin ? "Refund transaction" : "Request Refund";

  // A refund returns the money only. Staff must acknowledge they will fix the expiration date by hand when it applies.
  const [acknowledged, setAcknowledged] = React.useState(false);

  const onWriteSuccess = React.useCallback(() => {
    closeModal();
    onSuccess && onSuccess();
  }, [onSuccess, closeModal]);

  const { isRequesting, error, call  } = useWriteTransaction(isAdmin ? adminDeleteTransaction : deleteTransaction, onWriteSuccess);
  const onSubmit = React.useCallback(() => {
    call({ id: transaction.id });
  }, [call, transaction]);

  return (
    <>
      <ActionButton
        label={label}
        id={"transactions-list-delete"}
        variant={"contained"}
        color={"secondary"}
        disabled={disabled}
        onClick={() => { setAcknowledged(false); openModal(); }}
      />
      {isOpen && (
        <FormModal
          id="refund-transaction"
          loading={isRequesting}
          isOpen={isOpen}
          closeHandler={closeModal}
          title={title}
          onSubmit={onSubmit}
          error={error}
          submitDisabled={isAdmin && !acknowledged}
        >
          <Typography gutterBottom>
            {text}
          </Typography>
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
          { transaction.invoice &&
            <KeyValueItem label="Description">
              <span id="refund-transaction-description">{transaction.invoice.description}</span>
            </KeyValueItem>
          }
          { isAdmin &&
            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Checkbox
                  id="refund-transaction-acknowledge"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
              }
              label="A refund does not change the member's expiration date. If this was a membership payment, I will check the date and correct it by hand if needed. For a household, the second adult follows the primary's date."
            />
          }
        </FormModal>
      )}
    </>
  )
}

export default RefundTransactionModal;
