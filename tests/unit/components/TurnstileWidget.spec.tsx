import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { loadClientConfig } from "api/clientConfig";
import {
  TURNSTILE_ACTION,
  TurnstileWidget,
  TurnstileWidgetHandle
} from "components/Turnstile/TurnstileWidget";

jest.mock("api/clientConfig", () => ({ loadClientConfig: jest.fn() }));

const siteKey = "runtime-public-site-key";
const mockLoadClientConfig = loadClientConfig as jest.Mock;

describe("TurnstileWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    mockLoadClientConfig.mockResolvedValue({ turnstile_site_key: siteKey });
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
      await Promise.resolve();
    });

    const widgets = container.querySelectorAll(".cf-turnstile");
    expect(widgets).toHaveLength(2);
    widgets.forEach(widget => {
      expect(widget.getAttribute("data-sitekey")).toBe(siteKey);
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
      sitekey: siteKey,
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

  it("does not load or render Turnstile when runtime config has no site key", async () => {
    mockLoadClientConfig.mockResolvedValue({});

    await act(async () => {
      root.render(<TurnstileWidget onTokenChange={jest.fn()} />);
      await Promise.resolve();
    });

    expect(container.querySelector(".cf-turnstile")).toBeNull();
    expect(document.getElementById("cloudflare-turnstile-script")).toBeNull();
  });

  it("retries loading Turnstile after a transient script error", async () => {
    jest.useFakeTimers();
    const onTokenChange = jest.fn();
    const render = jest.fn().mockReturnValue("retried-widget");

    await act(async () => {
      root.render(<TurnstileWidget onTokenChange={onTokenChange} />);
      await Promise.resolve();
    });

    const failedScript = document.getElementById("cloudflare-turnstile-script")!;
    await act(async () => {
      failedScript.dispatchEvent(new Event("error"));
      await Promise.resolve();
    });

    expect(failedScript.isConnected).toBe(false);
    expect(onTokenChange).toHaveBeenLastCalledWith(undefined);

    act(() => jest.advanceTimersByTime(1000));
    const retriedScript = document.getElementById("cloudflare-turnstile-script")!;
    expect(retriedScript).not.toBe(failedScript);

    (window as any).turnstile = { render, reset: jest.fn(), remove: jest.fn() };
    await act(async () => {
      retriedScript.dispatchEvent(new Event("load"));
      await Promise.resolve();
    });

    expect(render).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
