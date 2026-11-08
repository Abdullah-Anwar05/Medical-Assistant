import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { HomeScreen } from '../src/screens/HomeScreen';
import { LoginScreen } from '../src/screens/LoginScreen';
import { isValidPastDate, RegisterScreen } from '../src/screens/RegisterScreen';
import { authResponse, call, json, makeClient, memoryStore } from './helpers';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

function Status() {
  const { status } = useAuth();
  const { Text } = jest.requireActual('react-native');
  return <Text testID="status">{status}</Text>;
}

async function renderWith(ui: ReactNode, responses: Response[], store = memoryStore()) {
  const ctx = makeClient(responses, store);
  await render(
    <AuthProvider client={ctx.client}>
      <Status />
      {ui}
    </AuthProvider>,
  );
  // Launch-time refresh with an empty Keychain resolves to signed out without a request.
  await waitFor(() => expect(screen.getByTestId('status')).not.toHaveTextContent('loading'));
  return ctx;
}

// The first React Native render in a worker lazily loads and transforms RN internals; on a cold
// Jest cache that takes ~5 s, which hit the 5 s default timeout of whichever test ran first.
// Pay that cost once here, outside any test's timeout.
beforeAll(async () => {
  await renderWith(<LoginScreen />, []);
  screen.unmount();
}, 60_000);

describe('LoginScreen', () => {
  it('validates required fields without calling the API', async () => {
    const { fetchImpl } = await renderWith(<LoginScreen />, []);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('signs in and becomes signedIn', async () => {
    const { fetchImpl } = await renderWith(<LoginScreen />, [json(200, authResponse())]);
    await fireEvent.changeText(screen.getByLabelText('Email address'), ' test.patient@example.test ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct horse battery');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(call(fetchImpl, 0).body.email).toBe('test.patient@example.test');
  });

  it('shows a generic alert on 401 (no user enumeration)', async () => {
    await renderWith(<LoginScreen />, [json(401, { title: 'Unauthorized', detail: 'User not found' })]);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'someone@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong password!!');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(screen.queryByText(/User not found/)).toBeNull();
  });

  it('shows the lockout message on 423', async () => {
    await renderWith(<LoginScreen />, [json(423, { title: 'Locked' })]);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'someone@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong password!!');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/wait 15 minutes/)).toBeTruthy();
  });

  it('navigates to registration', async () => {
    await renderWith(<LoginScreen />, []);
    await fireEvent.press(screen.getByRole('link', { name: 'Create an account' }));
    expect(mockPush).toHaveBeenCalledWith('/register');
  });
});

describe('RegisterScreen', () => {
  async function fill() {
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Testy');
    await fireEvent.changeText(screen.getByLabelText('Last name'), 'Patient');
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'test.patient@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'a long passphrase');
    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '1980-04-23');
  }

  it('enforces the 12-character minimum, date format and terms locally', async () => {
    const { fetchImpl } = await renderWith(<RegisterScreen />, []);
    await fill();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '23/04/1980');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 12 characters.')).toBeTruthy();
    expect(screen.getByText('Enter your date of birth as YYYY-MM-DD.')).toBeTruthy();
    expect(screen.getByText('You need to accept the terms to continue.')).toBeTruthy();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('registers with the contract body and signs in', async () => {
    const { fetchImpl } = await renderWith(<RegisterScreen />, [json(201, authResponse())]);
    await fill();
    await fireEvent(screen.getByLabelText('I accept the MediPath terms of use and privacy notice'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    const req = call(fetchImpl, 0);
    expect(req.url).toMatch(/\/api\/v1\/identity\/register$/);
    expect(req.headers['X-Client']).toBe('mobile');
    expect(req.body).toEqual({
      firstName: 'Testy',
      lastName: 'Patient',
      email: 'test.patient@example.test',
      password: 'a long passphrase',
      dateOfBirth: '1980-04-23',
      acceptedTermsVersion: expect.any(String),
    });
  });

  it('shows server field errors from a 400 Problem Details', async () => {
    await renderWith(<RegisterScreen />, [
      json(400, { title: 'Validation failed', errors: { Password: ['This password has appeared in a data breach.'] } }),
    ]);
    await fill();
    await fireEvent(screen.getByLabelText('I accept the MediPath terms of use and privacy notice'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('This password has appeared in a data breach.')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
  });
});

describe('HomeScreen', () => {
  it('signs out and clears the Keychain token', async () => {
    const store = memoryStore('stored');
    await renderWith(<HomeScreen />, [json(200, authResponse()), json(204)], store);
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn');
    expect(screen.getByText('Hello, Testy')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(store.value).toBeNull();
  });
});

describe('isValidPastDate', () => {
  it('rejects impossible and future dates', () => {
    const today = new Date('2026-11-08T00:00:00Z');
    expect(isValidPastDate('1980-02-30', today)).toBe(false);
    expect(isValidPastDate('2030-01-01', today)).toBe(false);
    expect(isValidPastDate('1980-02-29', today)).toBe(true);
  });
});
