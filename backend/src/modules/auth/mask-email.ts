/** k***@anu.edu.gh: enough to recognise the address without showing it. */
export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(6, name.length - 1)))}@${domain}`;
}
