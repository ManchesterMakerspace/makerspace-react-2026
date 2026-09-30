import { Routing } from "app/constants";

const key = "login-redirect";

export const defaultLoginDestination = (member: { id: string; role?: string; status?: string }): string => {
  if (["admin", "board_member", "resource_manager"].includes(member.role || "")) {
    return `${Routing.Members}/${member.id}`;
  }
  return member.status === "pending" ? `${Routing.Home}?newMember=true` : Routing.Home;
};

export const safeLoginRedirect = (value: string | null): string | null => {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f]/.test(value)) return null;
  const path = value.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if ([Routing.Root, Routing.Login, "/auth/callback"].includes(path)) return null;
  return value;
};

// Only login, the provider callback and security enrollment own this target.
// A normal login or navigating elsewhere abandons any earlier redirect.
export const loginDestination = (): string | null => {
  const { pathname, search } = window.location;
  const candidate = pathname === Routing.Login
    ? new URLSearchParams(search).get("redirect")
    : pathname === "/auth/callback" || /^\/members\/[^/]+\/settings\/security$/.test(pathname)
      ? sessionStorage.getItem(key) : null;
  const destination = safeLoginRedirect(candidate);
  if (destination) sessionStorage.setItem(key, destination);
  else clearLoginDestination();
  return destination;
};

export const clearLoginDestination = () => sessionStorage.removeItem(key);

export const rememberLoginDestination = (value: string | null) => {
  const destination = safeLoginRedirect(value);
  if (destination) sessionStorage.setItem(key, destination);
};
