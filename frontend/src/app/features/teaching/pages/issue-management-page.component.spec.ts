import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { IssueManagementPageComponent } from './issue-management-page.component';
import { IssueService } from '../../../core/services/issue.service';
import { createMockIssueService, createMockIssueForBoard } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

function renderBoard(options?: {
  issueService?: ReturnType<typeof createMockIssueService>;
}) {
  const issueService = options?.issueService ?? createMockIssueService();

  return render(IssueManagementPageComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [
      { provide: IssueService, useValue: issueService },
    ],
  }).then(result => ({ ...result, issueService }));
}

describe('IssueManagementPageComponent', () => {
  it('should call loadBoardIssues on init', async () => {
    const { issueService } = await renderBoard();
    expect(issueService.loadBoardIssues).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const issueService = createMockIssueService({ boardLoading: true });
    await renderBoard({ issueService });
    expect(screen.getByText('Loading issues...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const issueService = createMockIssueService({ boardError: 'Permission denied' });
    await renderBoard({ issueService });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no issues', async () => {
    await renderBoard();
    expect(screen.getByText('No issues found.')).toBeTruthy();
  });

  it('should render issue rows with correct data', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({
          id: 'iss-1',
          reporter: { full_name: 'Bob Santos', email: 'bob@santos.com' },
          course: { title: 'X-LNG Advanced' },
          issue_type: 'content_error',
          description: 'There is a typo in the formula on slide 3.',
        }),
      ],
    });

    await renderBoard({ issueService });

    expect(screen.getByText('bob@santos.com')).toBeTruthy();
    expect(screen.getByText('Bob Santos')).toBeTruthy();
    expect(screen.getByText('X-LNG Advanced')).toBeTruthy();
    // "Content Error" appears in both table cell and filter dropdown option
    expect(screen.getAllByText('Content Error').length).toBeGreaterThanOrEqual(1);
  });

  it('should show [Unknown] for null reporter', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', reporter: null }),
      ],
    });

    await renderBoard({ issueService });

    // [Unknown] appears in reporter column and expanded reporter info
    expect(screen.getByText('[Unknown]')).toBeTruthy();
  });

  it('should show Open badge for open issues', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', status: 'open' }),
      ],
    });

    await renderBoard({ issueService });
    // "Open" appears in summary card label and status badge + header badge
    expect(screen.getAllByText(/Open|open/).length).toBeGreaterThanOrEqual(2);
  });

  it('should show Investigating badge for investigating issues', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', status: 'investigating' }),
      ],
    });

    await renderBoard({ issueService });
    // "Investigating" appears in summary card label and status badge
    expect(screen.getAllByText('Investigating').length).toBeGreaterThanOrEqual(2);
  });

  it('should show Resolved badge for resolved issues', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', status: 'resolved' }),
      ],
    });

    await renderBoard({ issueService });
    // "Resolved" appears in summary card label and status badge
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(2);
  });

  it('should show Closed badge for closed issues', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', status: 'closed' }),
      ],
    });

    await renderBoard({ issueService });
    // "Closed" appears in summary card label and status badge
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by search term (email match)', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', reporter: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockIssueForBoard({ id: 'iss-2', reporter: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    const searchInput = screen.getByPlaceholderText('Search by reporter or description...');
    fireEvent.input(searchInput, { target: { value: 'alice' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by course', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', course_id: 'c1', reporter: { full_name: 'Alice', email: 'alice@test.com' }, course: { title: 'Course A' } }),
        createMockIssueForBoard({ id: 'iss-2', course_id: 'c2', reporter: { full_name: 'Bob', email: 'bob@test.com' }, course: { title: 'Course B' } }),
      ],
      boardCourses: [{ id: 'c1', title: 'Course A' }, { id: 'c2', title: 'Course B' }],
    });

    const { fixture } = await renderBoard({ issueService });

    const selects = screen.getAllByRole('combobox');
    const courseSelect = selects[0]; // first select is course dropdown
    fireEvent.change(courseSelect, { target: { value: 'c1' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by status', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', status: 'open', reporter: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockIssueForBoard({ id: 'iss-2', status: 'resolved', reporter: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1]; // second select is status
    fireEvent.change(statusSelect, { target: { value: 'open' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by issue type', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', issue_type: 'content_error', reporter: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockIssueForBoard({ id: 'iss-2', issue_type: 'technical', reporter: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[2]; // third select is issue type
    fireEvent.change(typeSelect, { target: { value: 'technical' } });
    fixture.detectChanges();

    expect(screen.queryByText('alice@test.com')).toBeFalsy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('should show summary cards with correct counts', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', status: 'open' }),
        createMockIssueForBoard({ id: 'iss-2', status: 'open' }),
        createMockIssueForBoard({ id: 'iss-3', status: 'investigating' }),
        createMockIssueForBoard({ id: 'iss-4', status: 'resolved' }),
        createMockIssueForBoard({ id: 'iss-5', status: 'closed' }),
      ],
    });

    const { container } = await renderBoard({ issueService });

    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total=5, Open=2, Investigating=1, Resolved=1, Closed=1
    expect(values).toEqual(['5', '2', '1', '1', '1']);
  });

  it('should expand row to show edit form', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({
          id: 'iss-1', status: 'open',
          reporter: { full_name: 'Alice', email: 'alice@test.com' },
          description: 'The video is not loading properly.',
        }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    expect(screen.getByPlaceholderText('Add internal notes (not visible to reporter)...')).toBeTruthy();
    expect(screen.getByText('Save Changes')).toBeTruthy();
    // Description appears in both truncated table cell and expanded detail
    expect(screen.getAllByText(/The video is not loading properly/).length).toBeGreaterThanOrEqual(1);
  });

  it('should pre-fill status and internal notes when expanding', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({
          id: 'iss-1', status: 'investigating',
          internal_notes: 'Checking with the author.',
          reporter: { full_name: 'Alice', email: 'alice@test.com' },
        }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    const statusSelect = screen.getAllByRole('combobox').find(el =>
      (el as HTMLSelectElement).value === 'investigating',
    ) as HTMLSelectElement;
    expect(statusSelect).toBeTruthy();
    expect(statusSelect.value).toBe('investigating');

    const textarea = screen.getByPlaceholderText('Add internal notes (not visible to reporter)...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Checking with the author.');
  });

  it('should call updateIssue on save', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({
          id: 'iss-1', status: 'open',
          reporter: { full_name: 'Alice', email: 'alice@test.com' },
        }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    // Expand
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    // Save
    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(issueService.updateIssue).toHaveBeenCalledWith('iss-1', {
      status: 'open',
      internal_notes: '',
    });
    expect(issueService.loadBoardIssues).toHaveBeenCalledTimes(2); // init + after save
  });

  it('should show save error on failure', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({
          id: 'iss-1', status: 'open',
          reporter: { full_name: 'Alice', email: 'alice@test.com' },
        }),
      ],
    });
    issueService.updateIssue.mockRejectedValue(new Error('Update failed'));

    const { fixture } = await renderBoard({ issueService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Update failed')).toBeTruthy();
  });

  it('should clear filters', async () => {
    const issueService = createMockIssueService({
      boardIssues: [
        createMockIssueForBoard({ id: 'iss-1', reporter: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockIssueForBoard({ id: 'iss-2', reporter: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ issueService });

    // Apply search filter
    fireEvent.input(screen.getByPlaceholderText('Search by reporter or description...'), { target: { value: 'alice' } });
    fixture.detectChanges();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();

    // Clear filters
    fireEvent.click(screen.getByText('Clear filters'));
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });
});
