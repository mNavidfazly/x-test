import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { MyIssuesPageComponent } from './my-issues-page.component';
import { IssueService } from '../../../core/services/issue.service';
import { createMockIssueService, createMockIssue } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { RouterLink } from '@angular/router';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

describe('MyIssuesPageComponent', () => {
  const renderPage = async (options?: {
    issues?: ReturnType<typeof createMockIssue>[];
    loading?: boolean;
    error?: string;
  }) => {
    const mockService = createMockIssueService({
      issues: options?.issues ?? [],
      loading: options?.loading ?? false,
      error: options?.error ?? '',
    });

    const result = await render(MyIssuesPageComponent, {
      providers: [
        provideRouter([]),
        { provide: IssueService, useValue: mockService },
      ],
      componentImports: [MockLucideIconComponent, RouterLink, ErrorAlertComponent],
    });

    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, mockService };
  };

  it('should call loadMyIssues on init', async () => {
    const { mockService } = await renderPage();
    expect(mockService.loadMyIssues).toHaveBeenCalled();
  });

  it('should show loading skeleton when loading', async () => {
    await renderPage({ loading: true });
    const container = document.querySelector('.animate-pulse');
    expect(container).toBeTruthy();
  });

  it('should show error message when error', async () => {
    await renderPage({ error: 'Something went wrong' });
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should show empty state when no issues', async () => {
    await renderPage();
    expect(screen.getByText('No issues reported yet')).toBeTruthy();
    expect(screen.getByText(/You can report issues/)).toBeTruthy();
  });

  it('should render page title', async () => {
    await renderPage();
    expect(screen.getByText('My Issues')).toBeTruthy();
  });

  it('should render issue cards', async () => {
    const issues = [
      createMockIssue({ id: 'iss-1', description: 'Typo on slide 3' }),
    ];
    await renderPage({ issues });
    expect(screen.getByText('Typo on slide 3')).toBeTruthy();
  });

  it('should show amber badge for open issues', async () => {
    const issues = [createMockIssue({ status: 'open' })];
    await renderPage({ issues });
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('should show blue badge for investigating issues', async () => {
    const issues = [createMockIssue({ status: 'investigating' })];
    await renderPage({ issues });
    expect(screen.getByText('Investigating')).toBeTruthy();
  });

  it('should show emerald badge for resolved issues', async () => {
    const issues = [createMockIssue({ status: 'resolved', resolved_at: '2026-02-10T10:00:00Z' })];
    await renderPage({ issues });
    expect(screen.getByText('Resolved')).toBeTruthy();
  });

  it('should show slate badge for closed issues', async () => {
    const issues = [createMockIssue({ status: 'closed' })];
    await renderPage({ issues });
    expect(screen.getByText('Closed')).toBeTruthy();
  });

  it('should show course name on issue card', async () => {
    const issues = [createMockIssue({ course: { title: 'X-LNG Advanced' } })];
    await renderPage({ issues });
    expect(screen.getByText('X-LNG Advanced')).toBeTruthy();
  });

  it('should show module name when present', async () => {
    const issues = [createMockIssue({ module: { title: 'Pricing Models' } })];
    await renderPage({ issues });
    expect(screen.getByText('/ Pricing Models')).toBeTruthy();
  });

  it('should show issue type label', async () => {
    const issues = [createMockIssue({ issue_type: 'accessibility' })];
    await renderPage({ issues });
    expect(screen.getByText('Accessibility')).toBeTruthy();
  });

  it('should expand issue detail on click', async () => {
    const issues = [createMockIssue({
      id: 'iss-1',
      description: 'Video not loading on slide 5',
    })];
    const { fixture } = await renderPage({ issues });

    const issueBtn = screen.getByText('Video not loading on slide 5').closest('button');
    if (issueBtn) {
      fireEvent.click(issueBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('should show "Go to module" link when module_id is present', async () => {
    const issues = [createMockIssue({ id: 'iss-1', module_id: 'mod-1' })];
    const { fixture } = await renderPage({ issues });

    const issueBtn = screen.getByText(/typo in the formula/).closest('button');
    if (issueBtn) {
      fireEvent.click(issueBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Go to module')).toBeTruthy();
  });

  it('should show issue count badge', async () => {
    const issues = [
      createMockIssue({ id: 'iss-1' }),
      createMockIssue({ id: 'iss-2' }),
    ];
    await renderPage({ issues });
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('should show resolution info when resolved', async () => {
    const issues = [createMockIssue({
      id: 'iss-1',
      status: 'resolved',
      resolved_at: '2026-02-10T10:00:00Z',
    })];
    const { fixture } = await renderPage({ issues });

    const issueBtn = screen.getByText(/typo in the formula/).closest('button');
    if (issueBtn) {
      fireEvent.click(issueBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Resolution')).toBeTruthy();
    expect(screen.getByText('This issue has been resolved.')).toBeTruthy();
  });
});
