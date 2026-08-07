import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockCreateToolCheckoutRequest = jest.fn();

jest.mock("api/toolCheckouts", () => ({
  createToolCheckoutRequest: (...args: unknown[]) =>
    mockCreateToolCheckoutRequest(...args),
}));

jest.mock("ui/common/FormModal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    children,
    onSubmit,
    submitText,
    error,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    onSubmit?: () => void;
    submitText?: string;
    error?: string;
  }) => isOpen ? (
    <div>
      {children}
      {error && <div>{error}</div>}
      <button onClick={onSubmit}>{submitText}</button>
    </div>
  ) : null,
}));

import {
  googleDriveEmbeddedFolderUrl,
} from "ui/workshops/workshopUrls";
import RequestCheckoutModal from "ui/workshops/RequestCheckoutModal";
import { WorkshopTool } from "app/entities/workshop";

const tool = (id: string, name: string): WorkshopTool => ({
  id,
  name,
  wikiUrl: `https://example.test/${id}`,
  disabled: false,
  reservable: false,
  prerequisiteIds: [],
  prerequisiteNames: [],
  unmetPrerequisiteIds: [],
  unmetPrerequisiteNames: [],
  checkoutRequestable: true,
  reservationAvailable: false,
});

const setInputValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(
    prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("WorkshopsPage helpers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateToolCheckoutRequest.mockResolvedValue({
      error: { message: "Request failed" },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("uses an account-agnostic Google Drive embed URL", () => {
    expect(googleDriveEmbeddedFolderUrl("folder id")).toBe(
      "https://drive.google.com/embeddedfolderview?id=folder%20id"
    );
  });

  it("clears checkout notes and errors when the modal changes tools", async () => {
    const firstTool = tool("tool-1", "Planer");
    const secondTool = tool("tool-2", "Lathe");
    const render = async (selectedTool: WorkshopTool | null) => {
      await act(async () => {
        root.render(
          <RequestCheckoutModal
            tool={selectedTool}
            onClose={jest.fn()}
            onCreated={jest.fn()}
          />
        );
      });
    };

    await render(firstTool);
    const note = document.body.querySelector(
      'textarea[aria-label="Note"], textarea'
    ) as HTMLTextAreaElement;
    await act(async () => setInputValue(note, "Old note"));
    const submit = Array.from(document.body.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Submit Request")) as HTMLButtonElement;
    await act(async () => submit.click());
    expect(document.body.textContent).toContain("Request failed");

    await render(null);
    await render(secondTool);

    const nextNote = document.body.querySelector(
      'textarea[aria-label="Note"], textarea'
    ) as HTMLTextAreaElement;
    expect(nextNote.value).toBe("");
    expect(document.body.textContent).not.toContain("Request failed");
  });
});
