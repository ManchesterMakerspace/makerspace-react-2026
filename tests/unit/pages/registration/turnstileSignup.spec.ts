jest.mock("makerspace-ts-api-client", () => ({
  isApiErrorResponse: (response: any) => !!response.error
}));

import { submitSignUpWithTurnstile } from "pages/registration/SignUpWorkflow/turnstileSignup";

const signUpDetails = {
  firstname: "First",
  lastname: "Last",
  email: "member@example.com",
  password: "password",
  address: {
    street: "123 Main Street",
    city: "Manchester",
    state: "NH",
    postalCode: "03101"
  }
};

describe("submitSignUpWithTurnstile", () => {
  it("adds the issued token to the signup request", async () => {
    const response = { data: { id: "member-id" } } as any;
    const submit = jest.fn().mockResolvedValue(response);
    const reset = jest.fn();

    await expect(
      submitSignUpWithTurnstile(submit, signUpDetails, "issued-token", reset)
    ).resolves.toBe(response);

    expect(submit).toHaveBeenCalledWith({
      ...signUpDetails,
      "cf-turnstile-response": "issued-token"
    });
    expect(reset).not.toHaveBeenCalled();
  });

  it("resets the widget after an API rejection", async () => {
    const response = { error: { message: "Turnstile verification failed" } } as any;
    const submit = jest.fn().mockResolvedValue(response);
    const reset = jest.fn();

    await expect(
      submitSignUpWithTurnstile(submit, signUpDetails, "redeemed-token", reset)
    ).resolves.toBe(response);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("resets the widget after a thrown request failure", async () => {
    const submit = jest.fn().mockRejectedValue(new Error("offline"));
    const reset = jest.fn();

    await expect(
      submitSignUpWithTurnstile(submit, signUpDetails, "redeemed-token", reset)
    ).rejects.toThrow("offline");

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
