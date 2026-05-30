import * as React from "react";
import { useNavigate } from 'react-router-dom';

import { Invoice } from "makerspace-ts-api-client";
import { Routing } from "app/constants";

import { useEmptyCart, useAddToCart } from "ui/checkout/cart";
import InvoicesTable from "./InvoicesTable";

const InvoicesList: React.FC = () => {
  const navigate = useNavigate();
  const resetCart = useEmptyCart();
  const addToCart = useAddToCart();
  const goToCheckout = React.useCallback((selectedInvoice: Invoice) =>  {
    resetCart();
    addToCart(selectedInvoice);
    navigate(Routing.Checkout);
  }, [resetCart, addToCart, history]);

  return <InvoicesTable stageInvoice={goToCheckout}/>;
};

export default InvoicesList;
