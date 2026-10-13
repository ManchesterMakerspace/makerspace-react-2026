import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { rememberPreferenceCookie } from 'ui/auth/rememberPreference';

jest.mock('react-redux', () => ({ connect: () => (Component: any) => Component }));
jest.mock('ui/utils/withRouter', () => ({ withRouter: (Component: any) => Component }));
jest.mock('ui/auth/actions', () => ({}));
jest.mock('ui/auth/firebase', () => ({
  preloadFirebaseAuth: jest.fn().mockResolvedValue(undefined),
  signInWithGoogle: jest.fn().mockResolvedValue('provider-token'),
}));
jest.mock('ui/auth/FirebaseAuthButtons', () => ({ __esModule: true,
  default: (props: any) => <button disabled={props.loading} onClick={props.onGoogleSignIn}>Google</button> }));
import LoginForm from 'ui/auth/LoginForm';

describe('phone stay-logged-in checkbox', () => {
  let root: Root;
  let container: HTMLDivElement;
  let props: any;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) Mobile/15E148');
    document.cookie = `${rememberPreferenceCookie}=; Max-Age=0; Path=/`;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    props = { auth: false, loginUser: jest.fn(), firebaseLogin: jest.fn().mockResolvedValue(undefined),
      cancelLogin: jest.fn().mockResolvedValue(undefined), clearTotpRequired: jest.fn() };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.restoreAllMocks();
  });
  const render = async () => { await act(async () => root.render(<LoginForm {...props} />)); };
  const checkbox = () => container.querySelector<HTMLInputElement>('input[type="checkbox"]');

  it('defaults on with an accessible label, saves opt-out, and preserves it after a failed login', async () => {
    await render();
    expect(checkbox()?.checked).toBe(true);
    expect(checkbox()?.closest('label')?.textContent).toBe('Stay logged in (uncheck this on a shared computer)');
    await act(async () => checkbox()!.click());
    expect(document.cookie).toContain(`${rememberPreferenceCookie}=false`);
    props.error = 'Invalid email or password.';
    await render();
    expect(checkbox()?.checked).toBe(false);
    // Remount represents a later visit to /login in the same browser.
    await act(async () => root.render(<div />));
    await render();
    expect(checkbox()?.checked).toBe(false);
    await act(async () => checkbox()!.click());
    expect(document.cookie).toContain(`${rememberPreferenceCookie}=true`);
  });

  it.each(['Mozilla/5.0 (Windows NT 10.0)', 'Mozilla/5.0 (iPad) Mobile/15E148', 'Mozilla/5.0 (Linux; Android 15; Tablet)'])(
    'hides the checkbox for %s', async agent => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent);
      await render();
      expect(checkbox()).toBeNull();
    }
  );

  it('applies the unchecked choice to provider login', async () => {
    await render();
    await act(async () => checkbox()!.click());
    const provider = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Google')!;
    await act(async () => provider.click());
    expect(props.firebaseLogin).toHaveBeenCalledWith('provider-token', false);
  });
});
