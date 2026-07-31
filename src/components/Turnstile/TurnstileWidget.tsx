import * as React from "react";

export const TURNSTILE_SITE_KEY = "0x4AAAAAAEBaoXYwLYluLrUY";
export const TURNSTILE_ACTION = "turnstile-spin-v2";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(): void;
    }
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        scriptPromise = undefined;
        reject(new Error("Cloudflare Turnstile loaded without exposing its browser API"));
      }
    };

    const handleError = () => {
      script?.remove();
      scriptPromise = undefined;
      reject(new Error("Cloudflare Turnstile failed to load"));
    };

    if (!script) {
      script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!script.isConnected) {
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
};

export interface TurnstileWidgetHandle {
  reset(): void;
}

interface Props {
  onTokenChange(token?: string): void;
}

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, Props>(
  ({ onTokenChange }, forwardedRef) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const widgetIdRef = React.useRef<string | undefined>(undefined);

    React.useImperativeHandle(forwardedRef, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
        onTokenChange(undefined);
      }
    }), [onTokenChange]);

    React.useEffect(() => {
      let cancelled = false;

      loadTurnstile()
        .then(turnstile => {
          if (cancelled || !containerRef.current) {
            return;
          }

          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            action: TURNSTILE_ACTION,
            callback: token => onTokenChange(token),
            "expired-callback": () => onTokenChange(undefined),
            "error-callback": () => onTokenChange(undefined)
          });
        })
        .catch(() => {
          if (!cancelled) {
            onTokenChange(undefined);
          }
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = undefined;
        }
      };
    }, [onTokenChange]);

    return (
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-sitekey={TURNSTILE_SITE_KEY}
        data-action={TURNSTILE_ACTION}
      />
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
