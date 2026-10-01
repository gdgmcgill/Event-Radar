import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignInButton } from './SignInButton';
const oauth = jest.fn();
const sendCode = jest.fn();
const verifyCode = jest.fn();
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: oauth, signInWithOtp: sendCode, verifyOtp: verifyCode } }) }));
beforeEach(() => { jest.clearAllMocks(); oauth.mockResolvedValue({ error: null }); sendCode.mockResolvedValue({ error: null }); verifyCode.mockResolvedValue({ error: new Error('private provider message') }); });
function open() { render(<SignInButton redirectAfterLogin="/recruiting/roles" />); fireEvent.click(screen.getByRole('button', { name: 'Sign In' })); }
it('offers Google with the callback and recruiter return path', async () => {
  open(); fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  await waitFor(() => expect(oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Frecruiting%2Froles`, queryParams: { prompt: 'select_account' } } }));
});
it('accepts a non-campus email, verifies its code, and gives a safe retry on expired codes', async () => {
  open(); fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'Reader@Example.org' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  await screen.findByLabelText('Email code');
  expect(sendCode).toHaveBeenCalledWith({ email: 'reader@example.org', options: { emailRedirectTo: expect.stringContaining('/auth/callback?next=') } });
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
  await screen.findByRole('alert');
  expect(verifyCode).toHaveBeenCalledWith({ email: 'reader@example.org', token: '123456', type: 'email' });
  expect(screen.getByRole('alert')).toHaveTextContent('invalid or expired');
  expect(screen.queryByText(/private provider message/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use another email or request a new code' }));
  expect(screen.getByLabelText('Email address')).toBeEnabled();
  expect(screen.queryByLabelText('Email code')).not.toBeInTheDocument();
});
