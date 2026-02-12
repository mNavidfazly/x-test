import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { EnrollmentCtaComponent } from './enrollment-cta.component';

describe('EnrollmentCtaComponent', () => {
  const renderCta = (props: {
    enrollmentType: 'open' | 'password_protected' | 'invite_only';
    isEnrolled: boolean;
    canEdit: boolean;
  }) =>
    render(EnrollmentCtaComponent, {
      componentInputs: {
        enrollmentType: props.enrollmentType,
        isEnrolled: props.isEnrolled,
        canEdit: props.canEdit,
      },
    });

  it('shows enrolled badge when already enrolled', async () => {
    await renderCta({ enrollmentType: 'open', isEnrolled: true, canEdit: false });
    expect(screen.getByText("You're enrolled")).toBeTruthy();
  });

  it('shows Enroll Now button for open course when not enrolled', async () => {
    await renderCta({ enrollmentType: 'open', isEnrolled: false, canEdit: false });
    expect(screen.getByRole('button', { name: /enroll now/i })).toBeTruthy();
  });

  it('shows password input for password_protected course when not enrolled', async () => {
    await renderCta({ enrollmentType: 'password_protected', isEnrolled: false, canEdit: false });
    expect(screen.getByPlaceholderText('Enter course password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /enroll/i })).toBeTruthy();
  });

  it('shows invite-only message for invite_only course when not enrolled', async () => {
    await renderCta({ enrollmentType: 'invite_only', isEnrolled: false, canEdit: false });
    expect(screen.getByText(/requires an invitation/i)).toBeTruthy();
  });

  it('shows nothing when canEdit is true', async () => {
    await renderCta({ enrollmentType: 'open', isEnrolled: false, canEdit: true });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/enroll/i)).toBeNull();
  });

  it('emits enroll event on Enroll Now click', async () => {
    const { fixture } = await renderCta({ enrollmentType: 'open', isEnrolled: false, canEdit: false });
    const component = fixture.componentInstance;
    let emitted = false;
    component.enroll.subscribe(() => { emitted = true; });

    const button = screen.getByRole('button', { name: /enroll now/i });
    await fireEvent.click(button);

    expect(emitted).toBe(true);
    expect(component.enrolling()).toBe(true);
  });

  it('emits enrollWithPassword with password value', async () => {
    const { fixture } = await renderCta({ enrollmentType: 'password_protected', isEnrolled: false, canEdit: false });
    const component = fixture.componentInstance;
    let emittedPassword = '';
    component.enrollWithPassword.subscribe((pwd: string) => { emittedPassword = pwd; });

    const input = screen.getByPlaceholderText('Enter course password') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'secret123' } });

    const button = screen.getByRole('button', { name: /enroll/i });
    await fireEvent.click(button);

    expect(emittedPassword).toBe('secret123');
    expect(component.enrolling()).toBe(true);
  });

  it('shows error when password is empty and submitted', async () => {
    await renderCta({ enrollmentType: 'password_protected', isEnrolled: false, canEdit: false });

    const button = screen.getByRole('button', { name: /enroll/i });
    await fireEvent.click(button);

    expect(screen.getByText('Please enter the course password')).toBeTruthy();
  });

  it('shows Enrolling... text when enrolling open course', async () => {
    const { fixture } = await renderCta({ enrollmentType: 'open', isEnrolled: false, canEdit: false });

    const button = screen.getByRole('button', { name: /enroll now/i });
    await fireEvent.click(button);

    fixture.detectChanges();
    expect(screen.getByText(/enrolling/i)).toBeTruthy();
  });
});
