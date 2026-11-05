// The household invitation link is /household/join#token=... The token is in the URL fragment, which the browser never sends to
// the server, so it stays out of request and access logs. It is read once, kept in this tab's sessionStorage (so it survives
// the sign-in and sign-up pages that follow), and taken out of the address bar. API calls send it in a request body.
const STORAGE_KEY = "householdInviteToken";

let memoryToken = "";

const readStorage = (): string => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const writeStorage = (token: string) => {
  try {
    if (token) {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be blocked (private window, site data off); the in-memory copy covers the same page session.
  }
};

const tokenFromLocation = (): string => {
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  // An older link carried the token in the query string; accept it, and still take it out of the address bar.
  const fromQuery = new URLSearchParams(window.location.search).get("token");
  return fromHash || fromQuery || "";
};

const removeTokenFromAddressBar = () => {
  const { pathname, search } = window.location;
  const query = new URLSearchParams(search);
  query.delete("token");
  const rest = query.toString();
  try {
    window.history.replaceState(window.history.state, "", pathname + (rest ? `?${rest}` : ""));
  } catch {
    // Not fatal: the token is only in the fragment, which is never sent anywhere.
  }
};

// The token from the link in the address bar if there is one (stored, and removed from the address bar), else the stored one.
export const captureInviteToken = (): string => {
  const fromLink = tokenFromLocation();
  if (fromLink) {
    memoryToken = fromLink;
    writeStorage(fromLink);
    removeTokenFromAddressBar();
    return fromLink;
  }
  return readStorage() || memoryToken;
};

export const hasInviteToken = (): boolean => !!(readStorage() || memoryToken);

export const clearInviteToken = () => {
  memoryToken = "";
  writeStorage("");
};
