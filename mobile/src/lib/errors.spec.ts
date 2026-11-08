import { fieldErrors } from './fieldErrors';

describe('field errors from the server', () => {
  it('maps each detail to its field', () => {
    expect(fieldErrors(['email must be an email', 'password should not be empty'])).toEqual({ email: 'must be an email', password: 'should not be empty' });
    expect(fieldErrors(undefined)).toEqual({});
  });
});

describe('problems the app detects itself', () => {
  it('keeps its own what, whose and fix instead of "something unexpected"', () => {
    const { AppProblem } = require('./appProblem') as typeof import('./appProblem');
    const p = new AppProblem({ kind: 'server', what: 'The server signed you in for the website, not for the app.', whose: 'The university server needs updating.', fix: 'Update the server, then sign in again.', retry: false });
    const d = p.toDescribed();
    expect(p instanceof Error).toBe(true);
    expect(d.kind).toBe('server');
    expect(d.what).toMatch('website, not for the app');
    expect(d.fix).toMatch('sign in again');
    expect(d.fields).toEqual({});
  });
});
