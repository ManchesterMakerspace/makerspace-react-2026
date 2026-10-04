import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";

let member: any;
let paymentSuccess: any;
const toast = jest.fn();
const writeCall = jest.fn();
const formSubmit = jest.fn();
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => ({ currentUser: member, isRequesting: false }) }));
jest.mock("components/Toast/Toast", () => ({ useToastContext: () => ({ create: toast }), ToastStatus: { Info: "info", Success: "success" } }));
jest.mock("ui/hooks/useWriteTransaction", () => ({ __esModule: true, default: (_fn: any, success: any) => {
  if (success) paymentSuccess = success;
  return { call: writeCall, isRequesting: false };
} }));
jest.mock("ui/hooks/useReadTransaction", () => () => ({ isRequesting: false }));
jest.mock("hooks/useMembershipOptions", () => ({ useMembershipOptions: () => ({ allOptions: [], discounts: [] }) }));
jest.mock("components/Form/FormContext", () => ({ useFormContext: () => ({ onSubmit: formSubmit }) }));
jest.mock("components/Feedback/DisplayedFeedback", () => ({ DisplayedFeedbackProvider: ({ children }: any) => children }));
jest.mock("pages/registration/SignUpWorkflow/SignUpFeedbackNotification", () => ({ SignUpFeedbackNotification: () => null }));
jest.mock("pages/registration/SignUpWorkflow/CartPreview", () => ({ MembershipPreview: () => null }));
jest.mock("pages/registration/SignUpWorkflow/constant", () => ({ useTotal: () => 65 }));
jest.mock("components/Form/Form", () => ({ Form: ({ children }: any) => <div>{children}</div> }));
jest.mock("components/Form/inputs/CheckboxInput", () => ({ CheckboxInput: () => null }));
jest.mock("ui/checkout/PaymentMethod", () => () => null);
jest.mock("ui/membership/DuplicateMembershipModal", () => () => null);
jest.mock("pages/registration/SignUpWorkflow/MemberInfoStep", () => ({ MemberInfoStep: () => null }));
jest.mock("pages/registration/SignUpWorkflow/PaymentStep", () => ({ PaymentStep: () => null }));
jest.mock("pages/registration/SignUpWorkflow/AgreementStep", () => ({ AgreementStep: () => {
  const { setActiveStep } = require("pages/registration/SignUpWorkflow/SignUpContext").useSignUpContext();
  return <button onClick={() => { member = { ...member, memberContractOnFile: true }; setActiveStep(2); }}>Sign agreement</button>;
} }));
jest.mock("pages/registration/MembershipOptions/MembershipSelectForm", () => ({ MembershipSelectForm: ({ onSubmit }: any) => {
  const { setActiveStep } = require("pages/registration/SignUpWorkflow/SignUpContext").useSignUpContext();
  const { noneInvoiceOption } = require("pages/registration/MembershipOptions/constants");
  return <><button onClick={() => onSubmit(noneInvoiceOption)}>No membership</button><button onClick={() => setActiveStep(4)}>Review payment</button></>;
} }));

import { SignUpWorkflow } from "pages/registration/SignUpWorkflow/SignUpWorkflow";
const Location = () => { const location = useLocation(); return <span data-location>{location.pathname + location.search}</span>; };

describe("signup completion destination", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = jest.fn().mockImplementation(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  });
  beforeEach(() => {
    jest.clearAllMocks();
    member = { id: "new-member", status: "pending", memberContractOnFile: false, firstname: "New", lastname: "Member" };
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));
  const button = (text: string) => Array.from(container.querySelectorAll("button")).find(node => node.textContent === text)!;
  const render = () => act(async () => root.render(<MemoryRouter initialEntries={["/signup"]}><SignUpWorkflow /><Location /></MemoryRouter>));

  it("retains new-signup intent after signing an agreement and successful payment", async () => {
    await render();
    await act(async () => button("Sign agreement").click());
    expect(member.memberContractOnFile).toBe(true);
    await act(async () => button("Review payment").click());
    await act(async () => paymentSuccess({ response: { data: { invoice: { id: "receipt" } } } }));
    expect(container.querySelector("[data-location]")?.textContent).toBe("/home?newMember=true");
    expect(toast).toHaveBeenCalled();
  });

  it("routes no-membership completion to the same welcome page", async () => {
    await render();
    await act(async () => button("Sign agreement").click());
    await act(async () => button("No membership").click());
    expect(container.querySelector("[data-location]")?.textContent).toBe("/home?newMember=true");
  });

  it("retains the profile destination for an existing member changing membership", async () => {
    member = { ...member, status: "activeMember", memberContractOnFile: true };
    await render();
    await act(async () => button("Review payment").click());
    await act(async () => paymentSuccess({ response: { data: {} } }));
    expect(container.querySelector("[data-location]")?.textContent).toBe("/members/new-member");
  });
});
