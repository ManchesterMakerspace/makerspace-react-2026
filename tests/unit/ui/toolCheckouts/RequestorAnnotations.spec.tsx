import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockSave = jest.fn();
jest.mock("ui/hooks/useWriteTransaction", () => () => ({ call: mockSave, isRequesting: false, error: "" }));
jest.mock("api/toolCheckouts", () => ({ adminUpdateToolAnnotation: jest.fn(), adminUpdateShopAnnotation: jest.fn() }));
jest.mock("ui/common/FormModal", () => ({ isOpen, children, onSubmit }: any) => isOpen ?
  <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>{children}<button type="submit">Save annotation</button></form> : null);

import ToolAnnotationCell from "ui/toolCheckouts/ToolAnnotationCell";
import ShopAnnotationCell from "ui/toolCheckouts/ShopAnnotationCell";
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
    await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Edit annotation")!.click());
    const input = container.querySelector("textarea")!;
    expect(input.value).toBe("Old note");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mockSave).toHaveBeenCalledWith({ id: "tool-1", annotation: null });
  });

  it("lets a shop manager clear the shop annotation", async () => {
    await act(async () => root.render(<ShopAnnotationCell shop={{ id: "shop-1", name: "Woodshop", requestorAnnotation: "Old shop note" } as any} onSaved={() => {}} />));
    expect(container.textContent).toContain("Old shop note");
    expect(container.querySelector('button[aria-label="About shop requestor annotations"]')).not.toBeNull();
    await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Edit annotation")!.click());
    const input = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mockSave).toHaveBeenCalledWith({ id: "shop-1", annotation: null });
  });

  it("explains the tool annotation override to approvers", async () => {
    await act(async () => root.render(<ToolAnnotationCell tool={{ id: "tool-1", name: "Saw" } as any} onSaved={() => {}} />));
    const help = container.querySelector('button[aria-label="About tool requestor annotations"]') as HTMLButtonElement;
    expect(help).not.toBeNull();
    await act(async () => help.focus());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toContain("overrides its shop annotation");
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
