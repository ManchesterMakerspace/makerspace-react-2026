import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  TURNSTILE_ACTION,
  TURNSTILE_SITE_KEY,
  TurnstileWidget,
  TurnstileWidgetHandle
} from "components/Turnstile/TurnstileWidget";

describe("TurnstileWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    delete (window as any).turnstile;
    document.getElementById("cloudflare-turnstile-script")?.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById("cloudflare-turnstile-script")?.remove();
    delete (window as any).turnstile;
  });

  it("loads once, renders the analytics action, and manages token lifecycle", async () => {
    const firstTokenChange = jest.fn();
    const secondTokenChange = jest.fn();
    const firstRef = React.createRef<TurnstileWidgetHandle>();
    const render = jest.fn()
      .mockReturnValueOnce("widget-one")
      .mockReturnValueOnce("widget-two");
    const reset = jest.fn();
    const remove = jest.fn();

    await act(async () => {
      root.render(
        <>
          <TurnstileWidget ref={firstRef} onTokenChange={firstTokenChange} />
          <TurnstileWidget onTokenChange={secondTokenChange} />
        </>
      );
    });

    const widgets = container.querySelectorAll(".cf-turnstile");
    expect(widgets).toHaveLength(2);
    widgets.forEach(widget => {
      expect(widget.getAttribute("data-sitekey")).toBe(TURNSTILE_SITE_KEY);
      expect(widget.getAttribute("data-action")).toBe(TURNSTILE_ACTION);
    });
    expect(document.querySelectorAll("#cloudflare-turnstile-script")).toHaveLength(1);

    (window as any).turnstile = { render, reset, remove };
    await act(async () => {
      document.getElementById("cloudflare-turnstile-script")!
        .dispatchEvent(new Event("load"));
      await Promise.resolve();
    });

    expect(render).toHaveBeenCalledTimes(2);
    const firstOptions = render.mock.calls[0][1];
    expect(firstOptions).toMatchObject({
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION
    });

    act(() => firstOptions.callback("issued-token"));
    expect(firstTokenChange).toHaveBeenLastCalledWith("issued-token");

    act(() => firstOptions["expired-callback"]());
    expect(firstTokenChange).toHaveBeenLastCalledWith(undefined);

    act(() => firstOptions["error-callback"]());
    expect(firstTokenChange).toHaveBeenLastCalledWith(undefined);

    act(() => firstRef.current!.reset());
    expect(reset).toHaveBeenCalledWith("widget-one");
    expect(firstTokenChange).toHaveBeenLastCalledWith(undefined);
  });
});
