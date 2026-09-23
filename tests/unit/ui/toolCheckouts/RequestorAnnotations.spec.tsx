import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockSave = jest.fn();
jest.mock("ui/hooks/useWriteTransaction", () => () => ({ call: mockSave, isRequesting: false, error: "" }));
jest.mock("api/toolCheckouts", () => ({ adminUpdateToolAnnotation: jest.fn() }));
jest.mock("ui/common/FormModal", () => ({ isOpen, children, onSubmit }: any) => isOpen ?
  <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>{children}<button type="submit">Save annotation</button></form> : null);

import ToolAnnotationCell from "ui/toolCheckouts/ToolAnnotationCell";
import RequestorAnnotationTooltip from "ui/toolCheckouts/RequestorAnnotationTooltip";

describe("requestor annotation UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("clears the tool override with null so the shop fallback is restored", async () => {
    await act(async () => root.render(<ToolAnnotationCell tool={{ id: "tool-1", name: "Saw", requestorAnnotation: "Old note" } as any} onSaved={() => {}} />));
    await act(async () => container.querySelector("button")!.click());
    const input = container.querySelector("textarea")!;
    expect(input.value).toBe("Old note");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mockSave).toHaveBeenCalledWith({ id: "tool-1", annotation: null });
  });

  it("offers a keyboard-focusable tooltip and hides it when no annotation exists", async () => {
    await act(async () => root.render(<RequestorAnnotationTooltip annotation={null} />));
    expect(container.querySelector("button")).toBeNull();
    await act(async () => root.render(<RequestorAnnotationTooltip annotation={"Current instructions\nSecond line"} />));
    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("Annotation for requestors");
    await act(async () => button.focus());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Current instructions\nSecond line");
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });
});
