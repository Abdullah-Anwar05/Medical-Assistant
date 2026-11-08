import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { palette } from '@medipath/client-core';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { applyPalette } from '../theme/applyPalette';
import { API, authResponse, problem, server } from './server';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('web composition of client-core', () => {
  it('publishes the shared palette as CSS custom properties', () => {
    const root = document.createElement('div');
    applyPalette(root);
    expect(root.style.getPropertyValue('--color-navy-900')).toBe(palette.navy900);
    expect(root.style.getPropertyValue('--color-error-bg')).toBe(palette.errorBg);
  });

  it('logs an unexpected refresh failure and treats the user as signed out', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(http.post(`${API}/refresh`, () => problem(503)));
    renderAt('/account');
    expect(await screen.findByRole('heading', { name: 'Sign in to MediPath' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Session refresh failed', expect.anything());
  });

  it('clears the local session when the logout request fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(
      http.post(`${API}/refresh`, () => HttpResponse.json(authResponse())),
      http.post(`${API}/logout`, () => problem(500)),
    );
    const user = userEvent.setup();
    renderAt('/account');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    const nav = await screen.findByRole('navigation', { name: 'Account' });
    await waitFor(() => expect(nav).toHaveTextContent('Sign in'));
    expect(consoleError).toHaveBeenCalled();
  });
});
