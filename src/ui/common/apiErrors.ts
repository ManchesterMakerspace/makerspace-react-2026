type ErrorValue = string | string[] | Record<string, unknown>;

type ApiErrorBody = {
  message?: string;
  error?: string | ApiErrorBody | Record<string, ErrorValue>;
  errors?: Record<string, ErrorValue> | string[] | string;
  full_messages?: string[];
};

const humanizeField = (field: string): string => field
  .replace(/_/g, " ")
  .replace(/\b\w/g, char => char.toUpperCase());

const isPlainObject = (value: unknown): value is Record<string, ErrorValue> => (
  !!value && typeof value === "object" && !Array.isArray(value)
);

const formatValue = (field: string, value: ErrorValue): string[] => {
  const fieldName = humanizeField(field);

  if (typeof value === "string") return [`${fieldName} ${value}`];
  if (Array.isArray(value)) return value.map(error => `${fieldName} ${error}`);
  if (isPlainObject(value)) return formatErrorMap(value).map(error => `${fieldName} ${error}`);

  return [];
};

const formatErrorMap = (errors: Record<string, ErrorValue>): string[] => Object.entries(errors)
  .filter(([field]) => !["message", "errors", "full_messages"].includes(field))
  .flatMap(([field, value]) => formatValue(field, value));

const formatErrors = (errors: ApiErrorBody["errors"]): string | undefined => {
  if (!errors) return undefined;
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return errors.join(". ");

  const messages = formatErrorMap(errors);
  return messages.length ? messages.join(". ") : undefined;
};

const formatNestedError = (error: ApiErrorBody["error"]): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "string") return error;

  return error.full_messages?.join(". ")
    || formatErrors(error.errors)
    || formatErrors(error as Record<string, ErrorValue>)
    || error.message;
};

export const apiErrorMessage = (body: ApiErrorBody, fallback: string): string => {
  if (!body) return fallback;

  return body.full_messages?.join(". ")
    || formatErrors(body.errors)
    || formatNestedError(body.error)
    || body.message
    || fallback;
};
