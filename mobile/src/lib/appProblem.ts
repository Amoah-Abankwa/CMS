import type { Described } from './errors';

/**
 * A problem the app itself detects (not an answer from the server), already said the usual way:
 * what went wrong, whose it is, and how to fix it. Screens show it like any other error.
 */
export class AppProblem extends Error {
  constructor(private readonly described: Omit<Described, 'fields'> & { fields?: Record<string, string> }) {
    super(described.what);
    this.name = 'AppProblem';
  }

  toDescribed(): Described {
    return { ...this.described, fields: this.described.fields ?? {} };
  }
}
