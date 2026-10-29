// How a member first heard of the makerspace, asked at signup and correctable by
// staff on the member profile. The values are stored as-is, so they mirror
// Member::SIGNUP_SOURCES on the server: a new choice goes in both lists.
export const CLASS_SIGNUP_SOURCE = "class";
export const REFERRAL_SIGNUP_SOURCE = "friend";

export const SIGNUP_SOURCES = [
  { value: CLASS_SIGNUP_SOURCE, label: "I took a class at the makerspace" },
  { value: "walk_in", label: "I visited or took a tour" },
  { value: REFERRAL_SIGNUP_SOURCE, label: "A friend or member told me" },
  { value: "website", label: "Website or web search" },
  { value: "social", label: "Social media" },
  { value: "other", label: "Other" },
];

// The sources that ask for a typed answer (the server keeps it only for these).
// The signup form words the question to the new member; staff see the plain label.
const SOURCE_DETAILS: { [source: string]: { signupLabel: string; placeholder: string; staffLabel: string } } = {
  [CLASS_SIGNUP_SOURCE]: { signupLabel: "Which class?", placeholder: "Class name", staffLabel: "Class name" },
  [REFERRAL_SIGNUP_SOURCE]: { signupLabel: "Who told you about us?", placeholder: "Their name", staffLabel: "Referrer, as the member typed it" },
};

export const signupSourceDetailPrompt = (source?: string) => SOURCE_DETAILS[source || ""];

/** The dropdown options, led by an empty choice because the question is optional. */
export const signupSourceOptions = (emptyLabel: string) => [
  { value: "", label: emptyLabel },
  ...SIGNUP_SOURCES,
];

/** A readable summary such as "I took a class at the makerspace: Intro to Welding". */
export const signupSourceSummary = (source?: string, detail?: string): string => {
  if (!source) return "";
  const label = SIGNUP_SOURCES.find(option => option.value === source)?.label || source;
  return detail ? `${label}: ${detail}` : label;
};
