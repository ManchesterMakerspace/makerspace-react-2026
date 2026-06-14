type ApiErrorBody = {
  message?: string;
  error?: string | ApiErrorBody;
  errors?: Record<string, string | string[]> | string[] | string;
};

const humanizeField = (field: string): string => field
  .replace(/_/g, " ")
  .replace(/\b\w/g, char => char.toUpperCase());

const formatErrors = (errors: ApiErrorBody["errors"]): string | undefined => {
  if (!errors) return undefined;
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return errors.join(". ");

  const messages = Object.entries(errors).flatMap(([field, value]) => {
    const fieldName = humanizeField(field);
    const values = Array.isArray(value) ? value : [value];
    return values.map(error => `${fieldName} ${error}`);
  });

  return messages.length ? messages.join(". ") : undefined;
};

export const apiErrorMessage = (body: ApiErrorBody, fallback: string): string => {
  if (!body) return fallback;
  if (typeof body.error === "string") return body.error;

  return body.message
    || body.error?.message
    || formatErrors(body.errors)
    || formatErrors(body.error?.errors)
    || fallback;
};
