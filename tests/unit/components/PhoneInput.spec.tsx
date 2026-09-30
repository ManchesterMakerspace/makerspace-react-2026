import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Form } from "components/Form/Form";
import { PhoneInput } from "components/Form/inputs/PhoneInput";

describe("signup phone number", () => {
  let root: Root;
  let container: HTMLDivElement;
  const submit = jest.fn();
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  beforeEach(() => {
    submit.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const render = async (defaultValue = "") => act(async () => root.render(
    <Form id="signup" onSubmit={submit}>
      <PhoneInput fieldName="phone" label="Phone Number" defaultValue={defaultValue} />
    </Form>
  ));
  const input = () => container.querySelector("input")!;
  const enter = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  const save = async () => act(async () => container.querySelector("button")!.click());

  it("allows the optional field to remain untouched and blank", async () => {
    await render();
    expect(input().required).toBe(false);
    expect(input().type).toBe("tel");
    await save();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ values: { phone: "" } }));
  });

  it.each(["0123456789", "+1 (603) 555-0123", "0044 20 7946 0123"])("preserves permitted characters in %s", async value => {
    await render();
    await enter(value);
    await save();
    expect(input().value).toBe(value);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ values: { phone: value } }));
  });

  it.each([
    ["call +1 (603) 555-0123!", " +1 (603) 555-0123"],
    ["603.555/0123#", "6035550123"],
    ["abcé１２３\t\n", ""],
  ])("filters disallowed characters from typed or pasted %s", async (value, expected) => {
    await render();
    await enter(value);
    await save();
    expect(input().value).toBe(expected);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ values: { phone: expected } }));
  });

  it("can be cleared after entering a number", async () => {
    await render();
    await enter("+1 (603) 555-0123");
    await enter("");
    await save();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ values: { phone: "" } }));
  });

  it("blocks disallowed characters in a prefilled value and identifies the field", async () => {
    await render("603.555.0123");
    await save();
    expect(submit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(input().getAttribute("aria-describedby")).toContain("phone-error");
    expect(container.textContent).toContain("Use only numbers 0–9");
  });
});
