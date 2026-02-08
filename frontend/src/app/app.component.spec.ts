import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter, RouterOutlet } from '@angular/router';
import { AppComponent } from './app.component';
import { SupabaseService } from './core/services/supabase.service';
import { createMockSupabaseService } from './__mocks__/supabase.mock';
import { MockLucideIconComponent } from './__mocks__/lucide.mock';

describe('AppComponent', () => {
  async function renderComponent() {
    const mockSupabase = createMockSupabaseService();

    return render(AppComponent, {
      componentImports: [MockLucideIconComponent, RouterOutlet],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    });
  }

  it('should render the application title', async () => {
    await renderComponent();
    expect(screen.getByText('X-Course v2')).toBeTruthy();
  });

  it('should render the subtitle', async () => {
    await renderComponent();
    expect(screen.getByText('Multi-Tenant Learning Platform')).toBeTruthy();
  });
});
