import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { API, authResponse, makeUser, problem, server } from './server';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('login', () => {
  it('signs a patient in and lands on their account', async () => {
    let body: unknown;
    let credentials: RequestCredentials | undefined;
    server.use(
      http.post(`${API}/login`, async ({ request }) => {
        body = await request.json();
        credentials = request.credentials;
        return HttpResponse.json(authResponse());
      }),
    );
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email address'), 'test.patient@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Testy' })).toBeInTheDocument();
    expect(body).toEqual({ email: 'test.patient@example.test', password: 'correct horse battery' });
    expect(credentials).toBe('include');
  });

  it('shows one generic message on 401 regardless of server detail', async () => {
    server.use(http.post(`${API}/login`, () => problem(401, { detail: 'No user with that email' })));
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email address'), 'nobody@example.test');
    await user.type(screen.getByLabelText('Password'), 'whatever-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(alert).not.toHaveTextContent('No user');
    expect(alert).toHaveFocus();
  });

  it('validates empty fields without calling the API', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends staff to MediWay after login', async () => {
    server.use(
      http.post(`${API}/login`, () =>
        HttpResponse.json(authResponse(makeUser(['Consultant'], { organisationId: 'org-synthetic-1' }))),
      ),
    );
    const user = userEvent.setup();
    renderAt('/mediway/login');
    await user.type(screen.getByLabelText('Email address'), 'test.consultant@example.test');
    await user.type(screen.getByLabelText('Password'), 'a-long-staff-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'MediWay staff portal' })).toBeInTheDocument();
  });
});

describe('register', () => {
  async function fill(password = 'a sufficiently long phrase') {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('First name'), 'Testy');
    await user.type(screen.getByLabelText('Last name'), 'Synthetic');
    await user.type(screen.getByLabelText('Email address'), 'test.patient@example.test');
    await user.type(screen.getByLabelText('Date of birth'), '1980-01-31');
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByLabelText(/I accept/));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    return user;
  }

  it('registers and lands on the account page', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/register`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(authResponse(), { status: 201 });
      }),
    );
    await fill();
    expect(await screen.findByRole('heading', { name: 'Welcome, Testy' })).toBeInTheDocument();
    expect(body).toMatchObject({ dateOfBirth: '1980-01-31', firstName: 'Testy' });
    expect(body.acceptedTermsVersion).toBeTruthy();
  });

  it('rejects passwords under 12 characters client-side', async () => {
    await fill('short');
    expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument();
  });

  it('maps Problem Details field errors onto fields', async () => {
    server.use(
      http.post(`${API}/register`, () =>
        problem(400, { errors: { Password: ['This password appears in a list of breached passwords.'] } }),
      ),
    );
    await fill();
    expect(await screen.findByText('This password appears in a list of breached passwords.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not confirm an existing account on 409', async () => {
    server.use(http.post(`${API}/register`, () => problem(409, { detail: 'Email already registered' })));
    await fill();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not create an account with these details');
    expect(alert).not.toHaveTextContent('already registered');
  });
});

describe('session and guards', () => {
  it('restores the session silently from the refresh cookie', async () => {
    server.use(http.post(`${API}/refresh`, () => HttpResponse.json(authResponse())));
    renderAt('/account');
    expect(await screen.findByRole('heading', { name: 'Welcome, Testy' })).toBeInTheDocument();
  });

  it('makes only one refresh call under StrictMode-style double mounting', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/refresh`, () => {
        calls++;
        return HttpResponse.json(authResponse());
      }),
    );
    const { StrictMode } = await import('react');
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/account']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    await screen.findByRole('heading', { name: 'Welcome, Testy' });
    expect(calls).toBe(1);
  });

  it('redirects anonymous users to login', async () => {
    renderAt('/mediway');
    expect(await screen.findByRole('heading', { name: 'Sign in to MediWay' })).toBeInTheDocument();
  });

  it('blocks patients from MediWay', async () => {
    server.use(http.post(`${API}/refresh`, () => HttpResponse.json(authResponse())));
    renderAt('/mediway');
    expect(await screen.findByRole('heading', { name: /do not have access/ })).toBeInTheDocument();
  });

  it('logs out with the bearer token and clears the session', async () => {
    let auth: string | null = null;
    server.use(
      http.post(`${API}/refresh`, () => HttpResponse.json(authResponse())),
      http.post(`${API}/logout`, ({ request }) => {
        auth = request.headers.get('Authorization');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAt('/account');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(auth).toBe('Bearer synthetic-access-token'));
    const nav = await screen.findByRole('navigation', { name: 'Account' });
    await waitFor(() => expect(nav).toHaveTextContent('Sign in'));
  });
});
