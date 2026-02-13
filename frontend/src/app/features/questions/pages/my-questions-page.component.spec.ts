import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { MyQuestionsPageComponent } from './my-questions-page.component';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { createMockExpertQuestionService, createMockExpertQuestion } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { RouterLink } from '@angular/router';

describe('MyQuestionsPageComponent', () => {
  const renderPage = async (options?: {
    questions?: ReturnType<typeof createMockExpertQuestion>[];
    loading?: boolean;
    error?: string;
  }) => {
    const mockService = createMockExpertQuestionService({
      questions: options?.questions ?? [],
      loading: options?.loading ?? false,
      error: options?.error ?? '',
    });

    const result = await render(MyQuestionsPageComponent, {
      providers: [
        provideRouter([]),
        { provide: ExpertQuestionService, useValue: mockService },
      ],
      componentImports: [MockLucideIconComponent, RouterLink],
    });

    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, mockService };
  };

  it('should call loadMyQuestions on init', async () => {
    const { mockService } = await renderPage();
    expect(mockService.loadMyQuestions).toHaveBeenCalled();
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

  it('should show empty state when no questions', async () => {
    await renderPage();
    expect(screen.getByText('No questions yet')).toBeTruthy();
    expect(screen.getByText(/You can ask an expert/)).toBeTruthy();
  });

  it('should render page title', async () => {
    await renderPage();
    expect(screen.getByText('My Questions')).toBeTruthy();
  });

  it('should render question cards', async () => {
    const questions = [
      createMockExpertQuestion({ id: 'eq-1', question_text: 'How does pricing work?' }),
    ];
    await renderPage({ questions });
    expect(screen.getByText('How does pricing work?')).toBeTruthy();
  });

  it('should show amber badge for pending questions', async () => {
    const questions = [createMockExpertQuestion({ status: 'pending' })];
    await renderPage({ questions });
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('should show emerald badge for answered questions', async () => {
    const questions = [createMockExpertQuestion({ status: 'answered', response_text: 'Here is the answer' })];
    await renderPage({ questions });
    expect(screen.getByText('Answered')).toBeTruthy();
  });

  it('should show slate badge for closed questions', async () => {
    const questions = [createMockExpertQuestion({ status: 'closed' })];
    await renderPage({ questions });
    expect(screen.getByText('Closed')).toBeTruthy();
  });

  it('should show course name on question card', async () => {
    const questions = [createMockExpertQuestion({ course: { title: 'X-LNG Advanced' } })];
    await renderPage({ questions });
    expect(screen.getByText('X-LNG Advanced')).toBeTruthy();
  });

  it('should show module name when present', async () => {
    const questions = [createMockExpertQuestion({ module: { title: 'Pricing Models' } })];
    await renderPage({ questions });
    expect(screen.getByText('/ Pricing Models')).toBeTruthy();
  });

  it('should expand question detail on click', async () => {
    const questions = [createMockExpertQuestion({
      id: 'eq-1',
      question_text: 'How does this concept work in detail?',
    })];
    const { fixture } = await renderPage({ questions });

    // Click the question row to expand
    const questionBtn = screen.getByText('How does this concept work in detail?').closest('button');
    if (questionBtn) {
      fireEvent.click(questionBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Your Question')).toBeTruthy();
  });

  it('should show expert response when status is answered', async () => {
    const questions = [createMockExpertQuestion({
      id: 'eq-1',
      status: 'answered',
      response_text: 'The formula uses FOB pricing because...',
      responder: { full_name: 'Dr. Chen', email: 'chen@calypso.com' },
      responded_at: '2026-02-11T10:00:00Z',
    })];
    const { fixture } = await renderPage({ questions });

    // Expand the question
    const questionBtn = screen.getByText(/How does this concept/).closest('button');
    if (questionBtn) {
      fireEvent.click(questionBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Expert Response')).toBeTruthy();
    expect(screen.getByText('The formula uses FOB pricing because...')).toBeTruthy();
    expect(screen.getByText('Dr. Chen')).toBeTruthy();
  });

  it('should show question count badge', async () => {
    const questions = [
      createMockExpertQuestion({ id: 'eq-1' }),
      createMockExpertQuestion({ id: 'eq-2' }),
    ];
    await renderPage({ questions });
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('should show "Go to module" link when module_id is present', async () => {
    const questions = [createMockExpertQuestion({ id: 'eq-1', module_id: 'mod-1' })];
    const { fixture } = await renderPage({ questions });

    const questionBtn = screen.getByText(/How does this concept/).closest('button');
    if (questionBtn) {
      fireEvent.click(questionBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Go to module')).toBeTruthy();
  });

  it('should show expert response when status is closed but response exists', async () => {
    const questions = [createMockExpertQuestion({
      id: 'eq-1',
      status: 'closed',
      response_text: 'The answer before closing was...',
      responder: { full_name: 'Dr. Chen', email: 'chen@calypso.com' },
      responded_at: '2026-02-11T10:00:00Z',
    })];
    const { fixture } = await renderPage({ questions });

    const questionBtn = screen.getByText(/How does this concept/).closest('button');
    if (questionBtn) {
      fireEvent.click(questionBtn);
      fixture.detectChanges();
    }

    expect(screen.getByText('Expert Response')).toBeTruthy();
    expect(screen.getByText('The answer before closing was...')).toBeTruthy();
  });

  it('should collapse question when clicked again', async () => {
    const questions = [createMockExpertQuestion({ id: 'eq-1' })];
    const { fixture } = await renderPage({ questions });

    const questionBtn = screen.getByText(/How does this concept/).closest('button');
    if (questionBtn) {
      // Expand
      fireEvent.click(questionBtn);
      fixture.detectChanges();
      expect(screen.getByText('Your Question')).toBeTruthy();

      // Collapse
      fireEvent.click(questionBtn);
      fixture.detectChanges();
      expect(screen.queryByText('Your Question')).toBeNull();
    }
  });
});
