import { createHmac } from 'node:crypto';

/** Codes change every 30 seconds, so a code sent to a friend outside the room stops working quickly. */
export const CODE_STEP_SECONDS = 30;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

export function codeAt(secret: string, step: number): string {
  const digest = createHmac('sha256', secret).update(String(step)).digest();
  let n = digest.readUInt32BE(0);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[n & 31];
    n >>>= 5;
  }
  return code;
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / CODE_STEP_SECONDS);
}

/** Accepts the current code and the previous one, to allow for typing time. */
export function codeMatches(secret: string, code: string, now = Date.now()) {
  const step = currentStep(now);
  return code === codeAt(secret, step) || code === codeAt(secret, step - 1);
}

export function secondsLeft(now = Date.now()) {
  return CODE_STEP_SECONDS - (Math.floor(now / 1000) % CODE_STEP_SECONDS);
}
