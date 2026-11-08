/** Checks for sign-in fields, each saying exactly how to fix the value. Null means fine. */
export const validate = {
  indexNumber(v: string) {
    const t = v.trim();
    if (!t) return 'Enter your index number.';
    if (!/^[A-Za-z]{2,6}\d{6,9}$/.test(t)) return 'Use the number on your student ID card, for example ANU25400001 (letters, then digits, no spaces).';
    return null;
  },
  email(v: string) {
    const t = v.trim();
    if (!t) return 'Enter your ANU email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'That is not a complete email address. It should look like name@anu.edu.gh.';
    return null;
  },
  password(v: string) {
    return v ? null : 'Enter your password.';
  },
  code(v: string) {
    return /^\d{6}$/.test(v.trim()) ? null : 'Enter the 6-digit code. Only numbers, no spaces.';
  },
};
