
import * as React from "react";
import useReadTransaction from "ui/hooks/useReadTransaction";
import {
  Discount,
  InvoiceOption,
  listBillingDiscounts,
} from "makerspace-ts-api-client";
import {
  byAmount,
  defaultPlanId,
  discountParam,
  invoiceOptionParam,
  noneInvoiceOption,
  prepaidInvoiceOption,
} from "pages/registration/MembershipOptions/constants";
import { useSearchQuery } from "hooks/useSearchQuery";
import { getMembershipOptionsRequest } from "hooks/membershipOptionsRequest";

interface ParsedInvoiceOptions {
  loading: boolean;
  error: string;
  promotionOptions: InvoiceOption[];
  normalOptions: InvoiceOption[];
  defaultOption?: InvoiceOption;
  allOptions: InvoiceOption[];
  discounts: Discount[];
}

export const useMembershipOptions = (includeNone?: boolean): ParsedInvoiceOptions => {
  const {
    invoiceOptionId,
    discountId,
  } = useSearchQuery({
    invoiceOptionId: invoiceOptionParam,
    discountId: discountParam,
  });
  const optionsRequest = getMembershipOptionsRequest(invoiceOptionId, discountId);

  const {
    isRequesting,
    error,
    data: membershipOptions
  } = useReadTransaction<any, InvoiceOption[]>(
    optionsRequest.apiFunction as any,
    optionsRequest.args as any,
    undefined,
    undefined,
    false
  );

  const { data: discounts } = useReadTransaction(listBillingDiscounts, {});

  return React.useMemo(() => {
    const promotionOptions: InvoiceOption[] = [];
    let defaultOption: InvoiceOption | undefined;

    const normalOptions = (membershipOptions || []).reduce((opts, option) => {
      if (option.planId === defaultPlanId) {
        defaultOption = option;
      }
      
      if (!option.disabled) {
        (option.isPromotion ? promotionOptions : opts).push(option);
      }
      return opts;
    }, [] as InvoiceOption[]);

    const sortedNormalOpts = normalOptions.sort(byAmount);
    
    return {
      error,
      loading: isRequesting,
      promotionOptions,
      discounts: discounts || [],
      normalOptions: sortedNormalOpts.concat(includeNone ? [noneInvoiceOption] : []),
      defaultOption: defaultOption || sortedNormalOpts[0],
      allOptions: promotionOptions.concat(sortedNormalOpts, includeNone ? [noneInvoiceOption] : [])
    };
  }, [membershipOptions, isRequesting, error, discounts]);
}
