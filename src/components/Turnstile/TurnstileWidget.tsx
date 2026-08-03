import * as React from "react";
import { loadClientConfig } from "api/clientConfig";

export const TURNSTILE_ACTION = "turnstile-spin-v2";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_LOAD_RETRY_DELAY_MS = 1000;

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
        scriptPromise = undefined;
        resolve(window.turnstile);
      } else {
        script?.remove();
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

interface ConfiguredProps extends Props {
  siteKey: string;
}

const ConfiguredTurnstileWidget = React.forwardRef<TurnstileWidgetHandle, ConfiguredProps>(
  ({ onTokenChange, siteKey }, forwardedRef) => {
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
      let retryTimeout: number | undefined;

      const loadAndRenderTurnstile = () => {
        loadTurnstile()
          .then(turnstile => {
            if (cancelled || !containerRef.current) {
              return;
            }

            widgetIdRef.current = turnstile.render(containerRef.current, {
              sitekey: siteKey,
              action: TURNSTILE_ACTION,
              callback: token => onTokenChange(token),
              "expired-callback": () => onTokenChange(undefined),
              "error-callback": () => onTokenChange(undefined)
            });
          })
          .catch(() => {
            if (!cancelled) {
              onTokenChange(undefined);
              retryTimeout = window.setTimeout(
                loadAndRenderTurnstile,
                TURNSTILE_LOAD_RETRY_DELAY_MS
              );
            }
          });
      };

      loadAndRenderTurnstile();

      return () => {
        cancelled = true;
        if (retryTimeout !== undefined) {
          window.clearTimeout(retryTimeout);
        }
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = undefined;
        }
      };
    }, [onTokenChange, siteKey]);

    return (
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-action={TURNSTILE_ACTION}
      />
    );
  }
);

ConfiguredTurnstileWidget.displayName = "ConfiguredTurnstileWidget";

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, Props>(
  ({ onTokenChange }, forwardedRef) => {
    const [siteKey, setSiteKey] = React.useState<string>();

    React.useEffect(() => {
      let cancelled = false;

      loadClientConfig()
        .then(config => {
          const configuredKey = typeof config.turnstile_site_key === "string"
            ? config.turnstile_site_key.trim()
            : "";
          if (!cancelled && configuredKey) {
            setSiteKey(configuredKey);
          }
        })
        .catch(() => {
          if (!cancelled) {
            onTokenChange(undefined);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [onTokenChange]);

    if (!siteKey) {
      return null;
    }

    return (
      <ConfiguredTurnstileWidget
        ref={forwardedRef}
        siteKey={siteKey}
        onTokenChange={onTokenChange}
      />
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
