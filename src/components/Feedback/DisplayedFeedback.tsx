import * as React from "react";

export enum FeedbackSeverity {
  Error = "error",
  Warning = "warning",
}

export interface DisplayedFeedback {
  id: string;
  severity: FeedbackSeverity;
  message: string;
}

interface DisplayedFeedbackContextValue {
  messages: DisplayedFeedback[];
  report(id: string, severity: FeedbackSeverity, message: string): void;
  clear(id: string): void;
}

const DisplayedFeedbackContext = React.createContext<DisplayedFeedbackContextValue>({
  messages: [],
  report: () => {},
  clear: () => {},
});

export const normalizeFeedbackText = (message: React.ReactNode): string => {
  if (typeof message === "string" || typeof message === "number") {
    return String(message).replace(/\s+/g, " ").trim();
  }
  if (Array.isArray(message)) {
    return message.map(normalizeFeedbackText).filter(Boolean).join(" ");
  }
  if (React.isValidElement(message)) {
    return normalizeFeedbackText((message.props as { children?: React.ReactNode }).children);
  }
  return "";
};

export const deduplicateFeedback = (
  messages: DisplayedFeedback[]
): DisplayedFeedback[] => {
  const seen = new Set<string>();
  return messages.filter(({ severity, message }) => {
    const key = `${severity}:${message.toLocaleLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const DisplayedFeedbackProvider: React.FC<{ children?: React.ReactNode }> = props => {
  const [reportedMessages, setReportedMessages] = React.useState<
    Record<string, DisplayedFeedback>
  >({});

  const report = React.useCallback(
    (id: string, severity: FeedbackSeverity, message: string) => {
      setReportedMessages(current => {
        const existing = current[id];
        if (existing?.severity === severity && existing.message === message) {
          return current;
        }
        return {
          ...current,
          [id]: { id, severity, message },
        };
      });
    },
    []
  );

  const clear = React.useCallback((id: string) => {
    setReportedMessages(current => {
      if (!current[id]) {
        return current;
      }
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const messages = React.useMemo(
    () => deduplicateFeedback(Object.values(reportedMessages)),
    [reportedMessages]
  );

  const value = React.useMemo(
    () => ({ messages, report, clear }),
    [messages, report, clear]
  );

  return (
    <DisplayedFeedbackContext.Provider value={value}>
      {props.children}
    </DisplayedFeedbackContext.Provider>
  );
};

export const useDisplayedFeedback = () =>
  React.useContext(DisplayedFeedbackContext);

export const useDisplayedFeedbackMessage = (
  severity: FeedbackSeverity,
  message: React.ReactNode
) => {
  const { report, clear } = useDisplayedFeedback();
  const id = React.useId();
  const text = normalizeFeedbackText(message);

  React.useEffect(() => {
    if (text) {
      report(id, severity, text);
    } else {
      clear(id);
    }
    return () => clear(id);
  }, [id, severity, text, report, clear]);
};
