import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Form } from "components/Form/Form";
import { PostalCodeInput } from "components/Form/inputs/PostalCodeInput";

describe("signup postal code", () => {
  let root: Root;
  let container: HTMLDivElement;
  const submit = jest.fn();
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  beforeEach(async () => {
    submit.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Form id="signup" onSubmit={submit}>
      <PostalCodeInput fieldName="postal-code" label="Postal Code" required />
    </Form>));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const input = () => container.querySelector("input")!;
  const enter = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  const save = async () => act(async () => container.querySelector("button")!.click());

  it.each([
    ["03101", "03101"],
    ["03101-0123", "03101-0123"],
    ["031010123", "03101-0123"],
    ["ab03 101--0123!", "03101-0123"],
    ["031010123456", "03101-0123"],
  ])("formats %s as %s and submits the exact string", async (value, expected) => {
    await enter(value);
    expect(input().value).toBe(expected);
    await save();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ values: { "postal-code": expected } }));
  });

  it.each(["", "0310", "03101-", "03101-012"])("blocks incomplete postal code %s", async value => {
    await enter(value);
    await save();
    expect(submit).not.toHaveBeenCalled();
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input());
    expect(container.textContent).toContain(value ? "Enter a 5-digit ZIP code or ZIP+4" : "Required");
  });

  it("allows editing ZIP+4 back to a five-digit ZIP without losing leading zeros", async () => {
    await enter("031010123");
    await enter("03101-");
    await enter("03101");
    await save();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ values: { "postal-code": "03101" } }));
  });
});
