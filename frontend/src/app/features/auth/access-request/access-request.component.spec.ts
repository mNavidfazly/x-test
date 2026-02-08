import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { AccessRequestComponent } from './access-request.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('AccessRequestComponent', () => {
  async function renderComponent(options?: {
    supabase?: ReturnType<typeof createMockSupabaseService>;
  }) {
    const supabase = options?.supabase ?? createMockSupabaseService();

    await render(AccessRequestComponent, {
      componentImports: [MockLucideIconComponent, FormsModule],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    return { supabase };
  }

  it('should render full name and email inputs', async () => {
    await renderComponent();
    expect(screen.getByLabelText('Full Name')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeTruthy();
  });

  it('should show validation error when fields are empty', async () => {
    await renderComponent();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeTruthy();
    });
  });

  it('should call Supabase insert on submit', async () => {
    const supabase = createMockSupabaseService();
    // Mock the from().insert() chain to return success
    const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null });
    supabase.client.from = vi.fn().mockReturnValue({
      insert: mockInsert,
    });

    await renderComponent({ supabase });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@acme.com');
    await user.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/your request has been submitted/i)).toBeTruthy();
    });

    expect(supabase.client.from).toHaveBeenCalledWith('access_requests');
    expect(mockInsert).toHaveBeenCalledWith({
      email: 'john@acme.com',
      full_name: 'John Doe',
      domain: 'acme.com',
      status: 'pending',
    });
  });

  it('should show back to sign in link', async () => {
    await renderComponent();
    expect(screen.getByText(/back to sign in/i)).toBeTruthy();
  });
});
