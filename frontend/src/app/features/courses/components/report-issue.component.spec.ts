import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { ReportIssueComponent } from './report-issue.component';
import { IssueService } from '../../../core/services/issue.service';
import { createMockIssueService } from '../../../__mocks__/course.mock';

describe('ReportIssueComponent', () => {
  const renderReportIssue = async (options?: {
    courseId?: string;
    moduleId?: string;
    mockService?: ReturnType<typeof createMockIssueService>;
  }) => {
    const mockService = options?.mockService ?? createMockIssueService();

    const result = await render(ReportIssueComponent, {
      componentInputs: {
        courseId: options?.courseId ?? 'course-1',
        moduleId: options?.moduleId ?? 'mod-1',
      },
      providers: [
        { provide: IssueService, useValue: mockService },
      ],
    });

    return { ...result, mockService };
  };

  it('should show "Report Issue" button initially', async () => {
    await renderReportIssue();
    expect(screen.getByText('Report Issue')).toBeTruthy();
  });

  it('should expand form when button is clicked', async () => {
    await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    expect(screen.getByText('Report an Issue')).toBeTruthy();
    expect(screen.getByPlaceholderText('Describe the issue...')).toBeTruthy();
    expect(screen.getByText('Submit Report')).toBeTruthy();
  });

  it('should show issue type dropdown with 4 options', async () => {
    const { fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    // 4 real options + 1 disabled placeholder
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(5);
    expect(options[1].textContent).toContain('Content Error');
    expect(options[2].textContent).toContain('Technical Problem');
    expect(options[3].textContent).toContain('Accessibility Issue');
    expect(options[4].textContent).toContain('Other');
  });

  it('should disable submit when description is empty', async () => {
    const { fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    // Select an issue type
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'technical' } });
    fixture.detectChanges();

    const submitBtn = screen.getByText('Submit Report');
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('should disable submit when issue type is not selected', async () => {
    const { fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    // Type description but don't select issue type
    const textarea = screen.getByPlaceholderText('Describe the issue...');
    fireEvent.input(textarea, { target: { value: 'Some issue' } });
    fixture.detectChanges();

    const submitBtn = screen.getByText('Submit Report');
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('should call reportIssue with correct params on submit', async () => {
    const { mockService, fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'content_error' } });
    fixture.detectChanges();

    const textarea = screen.getByPlaceholderText('Describe the issue...');
    fireEvent.input(textarea, { target: { value: 'Typo on slide 3' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Report'));
    await new Promise(r => setTimeout(r));

    expect(mockService.reportIssue).toHaveBeenCalledWith('course-1', 'mod-1', 'content_error', 'Typo on slide 3');
  });

  it('should show success message after successful submission', async () => {
    const { mockService, fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'technical' } });
    fixture.detectChanges();

    const textarea = screen.getByPlaceholderText('Describe the issue...');
    fireEvent.input(textarea, { target: { value: 'Video not loading' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Report'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText(/Your issue has been reported/)).toBeTruthy();
  });

  it('should show error message on submit failure', async () => {
    const mockService = createMockIssueService();
    mockService.reportIssue.mockRejectedValueOnce(new Error('Network error'));

    const { fixture } = await renderReportIssue({ mockService });

    fireEvent.click(screen.getByText('Report Issue'));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'other' } });
    fixture.detectChanges();

    const textarea = screen.getByPlaceholderText('Describe the issue...');
    fireEvent.input(textarea, { target: { value: 'Something is wrong' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Report'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('should allow reporting another issue after success', async () => {
    const { fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'content_error' } });
    fixture.detectChanges();

    const textarea = screen.getByPlaceholderText('Describe the issue...');
    fireEvent.input(textarea, { target: { value: 'Typo found' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Report'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Report another issue')).toBeTruthy();
    fireEvent.click(screen.getByText('Report another issue'));
    fixture.detectChanges();

    // Back to initial button state
    expect(screen.getByText('Report Issue')).toBeTruthy();
  });

  it('should close form when X is clicked', async () => {
    const { fixture } = await renderReportIssue();

    fireEvent.click(screen.getByText('Report Issue'));
    expect(screen.getByPlaceholderText('Describe the issue...')).toBeTruthy();

    // Find the X button in the form header
    const headerDiv = screen.getByText('Report an Issue').closest('div');
    const xButton = headerDiv?.querySelector('button:last-child');
    if (xButton) {
      fireEvent.click(xButton);
      fixture.detectChanges();
    }

    // Textarea should be gone
    expect(screen.queryByPlaceholderText('Describe the issue...')).toBeNull();
  });
});
