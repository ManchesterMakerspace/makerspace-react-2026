const key = "checkout-return-to";
export const checkoutDestination = (): string | null => {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  // Only the checkout login, Firebase callback, and TOTP enrollment own this
  // target. A normal login, registration, or other navigation abandons it.
  const candidate = params.has("redirect") ? null
    : pathname === "/login" ? params.get("return_to")
    : pathname === "/auth/callback" || /^\/members\/[^/]+\/settings\/security$/.test(pathname) ? sessionStorage.getItem(key)
    : null;
  if (candidate && /^\/tools\/[a-f0-9]{24}\/request-checkout$/i.test(candidate)) {
    sessionStorage.setItem(key, candidate);
    return candidate;
  }
  clearCheckoutDestination();
  return null;
};
export const clearCheckoutDestination = () => sessionStorage.removeItem(key);
