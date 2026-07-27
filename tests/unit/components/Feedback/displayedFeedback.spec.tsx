import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  deduplicateFeedback,
  DisplayedFeedbackProvider,
  FeedbackSeverity,
} from "components/Feedback/DisplayedFeedback";
import ErrorMessage from "ui/common/ErrorMessage";
import WarningMessage from "ui/common/WarningMessage";
import {
  SIGNUP_FEEDBACK_AUTO_DISMISS_MS,
  SignUpFeedbackNotification,
} from "pages/registration/SignUpWorkflow/SignUpFeedbackNotification";

interface HarnessProps {
  errors?: string[];
  warning?: string;
}

const Harness: React.FC<HarnessProps> = props => {
  const errors = props.errors || [];
  return (
    <DisplayedFeedbackProvider>
      {errors.map((error, index) => (
        <ErrorMessage error={error} key={`${error}-${index}`} />
      ))}
      {props.warning && <WarningMessage warning={props.warning} />}
      <SignUpFeedbackNotification />
    </DisplayedFeedbackProvider>
  );
};

describe("displayed signup feedback", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  it("deduplicates normalized text without merging different severities", () => {
    expect(
      deduplicateFeedback([
        { id: "1", severity: FeedbackSeverity.Error, message: "Required" },
        { id: "2", severity: FeedbackSeverity.Error, message: "Required" },
        { id: "3", severity: FeedbackSeverity.Warning, message: "Required" },
      ])
    ).toEqual([
      { id: "1", severity: FeedbackSeverity.Error, message: "Required" },
      { id: "3", severity: FeedbackSeverity.Warning, message: "Required" },
    ]);
  });

  it("shows one summary per severity and auto-dismisses after ten seconds", async () => {
    await act(async () => {
      root.render(<Harness errors={["Required", "Required"]} warning="Check payment" />);
    });

    const notification = container.querySelector(
      "[data-testid='signup-feedback-notification']"
    );
    expect(notification).not.toBeNull();
    expect(notification!.querySelectorAll("li")).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(SIGNUP_FEEDBACK_AUTO_DISMISS_MS);
    });
    expect(
      container.querySelector("[data-testid='signup-feedback-notification']")
    ).toBeNull();
  });

  it("dismisses on backdrop click and reopens only for changed feedback", async () => {
    await act(async () => {
      root.render(<Harness errors={["First error"]} />);
    });

    const backdrop = container.querySelector(
      "[data-testid='signup-feedback-backdrop']"
    );
    act(() => {
      backdrop!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(
      container.querySelector("[data-testid='signup-feedback-notification']")
    ).toBeNull();

    await act(async () => {
      root.render(<Harness errors={["First error"]} />);
    });
    expect(
      container.querySelector("[data-testid='signup-feedback-notification']")
    ).toBeNull();

    await act(async () => {
      root.render(<Harness errors={["Second error"]} />);
    });
    expect(
      container.querySelector("[data-testid='signup-feedback-notification']")
    ).not.toBeNull();
  });
});
