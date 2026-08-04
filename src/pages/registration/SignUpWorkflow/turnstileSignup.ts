import {
  ApiDataResponse,
  ApiErrorResponse,
  isApiErrorResponse,
  Member
} from "makerspace-ts-api-client";
import { SignUpForm } from "ui/auth/interfaces";

type RegistrationResponse = ApiErrorResponse | ApiDataResponse<Member>;
type SignUpDetails = Omit<SignUpForm, "cf-turnstile-response">;

const trimRegistrationValue = (value: unknown, fieldName?: string): unknown => {
  if (fieldName === "password") return value;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(item => trimRegistrationValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, trimRegistrationValue(child, key)])
    );
  }
  return value;
};

export const trimSignUpDetails = (details: SignUpDetails): SignUpDetails =>
  trimRegistrationValue(details) as SignUpDetails;

export const submitSignUpWithTurnstile = async (
  submit: (form: SignUpForm) => Promise<RegistrationResponse>,
  signUpDetails: SignUpDetails,
  token: string | undefined,
  reset: () => void
): Promise<RegistrationResponse> => {
  try {
    const response = await submit({
      ...trimSignUpDetails(signUpDetails),
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
