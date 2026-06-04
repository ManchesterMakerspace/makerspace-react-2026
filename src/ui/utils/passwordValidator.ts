/**
 * Password strength scoring utility
 * Rates password from 0-4 based on length and character variety
 */
export const scorePassword = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

/**
 * Check for repeating sequences of 4 or more of the same character (case insensitive)
 */
const hasRepeatingSequence = (password: string): boolean => {
  // Match 4 or more of the same character (case insensitive)
  return /(.)\1{3,}/i.test(password);
};

/**
 * Validate a password against common criteria
 * 
 * For user creation context, pass allFormFields to check against any form field value
 * For password change context, pass existingAttributes (name, email, address) to check against
 * 
 * Returns null if valid, or an error message if invalid
 */
export const validatePassword = (
  password: string,
  options?: {
    allFormFields?: Record<string, any>;
    existingAttributes?: { name?: string; email?: string; address?: string };
  }
): string | null => {
  if (!password) return "Password cannot be blank.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  
  const strength = scorePassword(password);
  if (strength < 2) return "Password is too weak. Try mixing uppercase, numbers, or symbols.";
  
  // Check for repeating sequences
  if (hasRepeatingSequence(password)) return "Password is guessable.";
  
  // Check against form fields (for user creation)
  if (options?.allFormFields) {
    const passwordLower = password.toLowerCase();
    for (const [fieldName, fieldValue] of Object.entries(options.allFormFields)) {
      if (fieldValue && typeof fieldValue === 'string' && passwordLower === fieldValue.toLowerCase()) {
        return "Password is guessable.";
      }
    }
  }
  
  // Check against existing user attributes (for password change)
  if (options?.existingAttributes) {
    const passwordLower = password.toLowerCase();
    const { name, email, address } = options.existingAttributes;
    
    if (name && passwordLower === name.toLowerCase()) return "Password is guessable.";
    if (email && passwordLower === email.toLowerCase()) return "Password is guessable.";
    if (address && passwordLower === address.toLowerCase()) return "Password is guessable.";
  }
  
  return null;
};
