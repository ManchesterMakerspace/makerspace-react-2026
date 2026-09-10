const key = "checkout-return-to";
export const checkoutDestination = (): string | null => {
  const candidate = new URLSearchParams(window.location.search).get("return_to") || sessionStorage.getItem(key);
  if (candidate && /^\/tools\/[a-f0-9]{24}\/request-checkout$/i.test(candidate)) {
    sessionStorage.setItem(key, candidate);
    return candidate;
  }
  return null;
};
export const clearCheckoutDestination = () => sessionStorage.removeItem(key);
