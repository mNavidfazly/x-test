import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockProfileService } from '../../__mocks__/profile.mock';

@Component({ selector: 'app-test-child', standalone: true, template: '<p>Test child content</p>' })
class TestChildComponent {}

async function renderLayout() {
  const auth = createMockAuthService({ isAuthenticated: true, roles: ['learner'] });
  const profile = createMockProfileService({ profile: { full_name: 'Test', avatar_url: null } });

  const { fixture } = await render(MainLayoutComponent, {
    providers: [
      provideRouter([{ path: '**', component: TestChildComponent }]),
      { provide: AuthService, useValue: auth },
      { provide: ProfileService, useValue: profile },
    ],
  });

  return { fixture, auth, profile };
}

describe('MainLayoutComponent', () => {
  it('should render sidebar', async () => {
    await renderLayout();
    expect(screen.getByText('X-Course')).toBeTruthy();
  });

  it('should render header', async () => {
    await renderLayout();
    expect(screen.getByLabelText('Toggle menu')).toBeTruthy();
  });

  it('should render child route content', async () => {
    await renderLayout();
    expect(screen.getByText('Test child content')).toBeTruthy();
  });

  it('should toggle sidebar on menu button click', async () => {
    const { fixture } = await renderLayout();
    const user = userEvent.setup();

    // Initially no backdrop visible (sidebar closed)
    expect(fixture.nativeElement.querySelector('.bg-black\\/50')).toBeNull();

    // Click hamburger to open
    await user.click(screen.getByLabelText('Toggle menu'));
    expect(fixture.nativeElement.querySelector('.bg-black\\/50')).toBeTruthy();
  });

  it('should close sidebar when backdrop clicked', async () => {
    const { fixture } = await renderLayout();
    const user = userEvent.setup();

    // Open sidebar
    await user.click(screen.getByLabelText('Toggle menu'));
    expect(fixture.nativeElement.querySelector('.bg-black\\/50')).toBeTruthy();

    // Click backdrop to close
    await user.click(fixture.nativeElement.querySelector('.bg-black\\/50'));
    expect(fixture.nativeElement.querySelector('.bg-black\\/50')).toBeNull();
  });
});
