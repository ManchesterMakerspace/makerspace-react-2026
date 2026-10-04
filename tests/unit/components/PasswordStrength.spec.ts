import { getPasswordStrength, validatePasswordStrength } from "components/Form/inputs/PasswordStrength";

describe("password strength with member email", () => {
  it.each([
    "foobar@example.com",
    "foobar@example.com1",
    "123foobar@example.com",
    "123foobar@example.com567",
    "!LongPrefix123FOOBAR@EXAMPLE.COM567LongSuffix!",
  ])("marks %s as guessable with a weak score and blocks validation", password => {
    expect(getPasswordStrength(password, { email: "  Foobar@Example.com  " })).toMatchObject({
      score: 1, label: "Guessable", isGuessable: true, error: "Guessable",
    });
  });

  it.each([undefined, "", "   ", "other@example.com"])("does not match an absent or different email %s", email => {
    const password = "123foobar@example.com567";
    expect(getPasswordStrength(password, { email })).toMatchObject({ score: 4, label: "Strong", isGuessable: false });
    expect(validatePasswordStrength(password, { email })).toBeUndefined();
  });

  it("does not reject a password solely because it contains the email domain", () => {
    expect(validatePasswordStrength("Something@example.com123!", { email: "foobar@example.com" })).toBeUndefined();
  });

  it("preserves existing checks for profile values and short passwords", () => {
    expect(getPasswordStrength("Manchester", { city: "Manchester" }).isGuessable).toBe(true);
    expect(getPasswordStrength("foobar", { email: "foobar@example.com" }).isGuessable).toBe(true);
    expect(validatePasswordStrength("", { email: "foobar@example.com" })).toBe("Password cannot be blank.");
    expect(validatePasswordStrength("1234567")).toBe("Password must be at least 8 characters.");
  });
});
