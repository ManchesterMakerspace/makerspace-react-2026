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

  it("trims every registration string except the password", async () => {
    const response = { data: { id: "member-id" } } as any;
    const submit = jest.fn().mockResolvedValue(response);
    const reset = jest.fn();
    const details = {
      ...signUpDetails,
      firstname: "  First ",
      lastname: " Last  ",
      email: " member@example.com ",
      confirmEmail: " member@example.com  ",
      phone: " 603-555-0100 ",
      password: "  password with spaces  ",
      address: {
        street: " 123 Main Street ",
        unit: " Apt 2 ",
        city: " Manchester ",
        state: " NH ",
        postalCode: " 03101 "
      }
    };

    await submitSignUpWithTurnstile(submit, details, " token-with-spaces ", reset);

    expect(submit).toHaveBeenCalledWith({
      firstname: "First",
      lastname: "Last",
      email: "member@example.com",
      confirmEmail: "member@example.com",
      phone: "603-555-0100",
      password: "  password with spaces  ",
      address: {
        street: "123 Main Street",
        unit: "Apt 2",
        city: "Manchester",
        state: "NH",
        postalCode: "03101"
      },
      "cf-turnstile-response": " token-with-spaces "
    });
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
