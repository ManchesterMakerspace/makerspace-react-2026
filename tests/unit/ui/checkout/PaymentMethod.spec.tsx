import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import PaymentMethodComponent from "ui/checkout/PaymentMethod";

describe("PaymentMethodComponent", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  it("shows the card expiration month and year in red and bold when it expires this month", async () => {
    await act(async () => {
      root.render(
        <PaymentMethodComponent
          id="card-1"
          cardType="Visa"
          last4={1234}
          expirationMonth={8}
          expirationYear={2026}
        />
      );
    });

    expect(container.textContent).toContain("Visa ending in 1234 · Expires 08/2026");
    const expiration = container.querySelector<HTMLElement>("[data-payment-method-expiration]")!;
    expect(expiration.style.color).toBe("rgb(176, 0, 32)");
    expect(expiration.style.fontWeight).toBe("700");
  });

  it("shows other expiration dates without warning styling", async () => {
    await act(async () => {
      root.render(
        <PaymentMethodComponent
          id="card-2"
          cardType="Mastercard"
          last4={5678}
          expirationMonth={9}
          expirationYear={2026}
        />
      );
    });

    expect(container.textContent).toContain("Mastercard ending in 5678 · Expires 09/2026");
    const expiration = container.querySelector<HTMLElement>("[data-payment-method-expiration]")!;
    expect(expiration.getAttribute("style")).toBeNull();
  });
});
