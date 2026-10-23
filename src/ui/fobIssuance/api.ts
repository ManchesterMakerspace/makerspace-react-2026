// Fob issuer endpoints (Rails FobIssuanceController). Not in the generated API client
// yet, so they use fetch with the same CSRF header the other raw calls send.

export interface FobIssuanceMember {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  status: string;
  expirationTime?: number;
  addressStreet?: string;
  addressUnit?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  memberContractOnFile: boolean;
}

export interface Outcome<T> {
  data?: T;
  error?: string;
}

const csrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const headers = () => ({
  "Content-Type": "application/json",
  "X-XSRF-TOKEN": csrfToken(),
});

const send = async <T>(url: string, init?: RequestInit): Promise<Outcome<T>> => {
  try {
    const response = await fetch(url, { headers: headers(), ...init });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: body?.error?.message || body?.error || body?.message || "Something went wrong. Please try again." };
    }
    return { data: body as T };
  } catch {
    return { error: "An unexpected error occurred." };
  }
};

export const fobIssuanceApi = {
  searchMembers: (term: string) =>
    send<FobIssuanceMember[]>(`/api/fob_issuance/members?search=${encodeURIComponent(term)}`),
  newCard: () => send<{ uid?: string | null }>("/api/fob_issuance/cards/new"),
  issue: (memberId: string, uid: string, source: "import" | "nfc") =>
    send<unknown>("/api/fob_issuance/cards", {
      method: "POST",
      body: JSON.stringify({ member_id: memberId, uid, source }),
    }),
};
