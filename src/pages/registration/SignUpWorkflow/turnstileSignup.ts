import {
  ApiDataResponse,
  ApiErrorResponse,
  isApiErrorResponse,
  Member
} from "makerspace-ts-api-client";
import { SignUpForm } from "ui/auth/interfaces";

type RegistrationResponse = ApiErrorResponse | ApiDataResponse<Member>;
type SignUpDetails = Omit<SignUpForm, "cf-turnstile-response">;

export const submitSignUpWithTurnstile = async (
  submit: (form: SignUpForm) => Promise<RegistrationResponse>,
  signUpDetails: SignUpDetails,
  token: string | undefined,
  reset: () => void
): Promise<RegistrationResponse> => {
  try {
    const response = await submit({
      ...signUpDetails,
      "cf-turnstile-response": token || ""
    });

    if (isApiErrorResponse(response)) {
      reset();
    }

    return response;
  } catch (error) {
    reset();
    throw error;
  }
};
