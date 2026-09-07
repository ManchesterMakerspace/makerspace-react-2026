export const CONTACT_EMAIL = process.env.SMTP_FROM || "contact@manchestermakerspace.org";

export const contactMailto = (subject?: string) =>
  `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
