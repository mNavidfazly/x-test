import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { QuizTakerComponent } from './quiz-taker.component';
import { QuizQuestionComponent } from './quiz-question.component';
import { QuizResultItemComponent } from './quiz-result-item.component';
import { CourseService } from '../../../core/services/course.service';
import {
  createMockCourseService,
  createMockQuizTakingData,
  createMockQuizAttempt,
  createMockQuizResults,
  createMockQuizQuestionResult,
  MockCourseService,
} from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('QuizTakerComponent', () => {
  let mockService: MockCourseService;

  beforeEach(() => {
    mockService = createMockCourseService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = async (service: MockCourseService) => {
    const quizCompletedSpy = vi.fn();
    const result = await render(QuizTakerComponent, {
      componentInputs: { moduleId: 'mod-1' },
      componentImports: [MockLucideIconComponent, QuizQuestionComponent, QuizResultItemComponent],
      providers: [
        { provide: CourseService, useValue: service },
      ],
      on: { quizCompleted: quizCompletedSpy },
    });

    // Flush the effect
    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, quizCompletedSpy };
  };

  // ─── 1. Loading state ───────────────────────────────────────────────
  it('should show loading skeleton initially before effect fires', async () => {
    // Make loadQuizForTaking never resolve so we stay in loading state
    mockService.loadQuizForTaking.mockReturnValue(new Promise(() => {}));

    await render(QuizTakerComponent, {
      componentInputs: { moduleId: 'mod-1' },
      componentImports: [MockLucideIconComponent, QuizQuestionComponent, QuizResultItemComponent],
      providers: [{ provide: CourseService, useValue: mockService }],
    });

    // Loading skeleton has animate-pulse divs
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  // ─── 2. Error state ────────────────────────────────────────────────
  it('should show error when loadQuizForTaking fails', async () => {
    mockService.loadQuizForTaking.mockRejectedValue(new Error('Network error'));

    await renderComponent(mockService);

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  // ─── 3. Quiz not found ────────────────────────────────────────────
  it('should show error when loadQuizForTaking returns null', async () => {
    mockService.loadQuizForTaking.mockResolvedValue(null);

    await renderComponent(mockService);

    expect(screen.getByText('Quiz not found')).toBeTruthy();
  });

  // ─── 4. Start phase - quiz info ───────────────────────────────────
  it('should show quiz metadata in start phase', async () => {
    const quiz = createMockQuizTakingData({ passing_score: 70, time_limit: 600, max_attempts: 3 });
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });

    await renderComponent(mockService);

    expect(screen.getByText('2')).toBeTruthy(); // 2 questions
    expect(screen.getByText('70%')).toBeTruthy(); // passing score
    expect(screen.getByText('10 minutes')).toBeTruthy(); // 600s = 10min
    expect(screen.getByText('0 / 3')).toBeTruthy(); // 0 used of 3 max
  });

  // ─── 5. Start phase - Start Quiz button ───────────────────────────
  it('should show Start Quiz button when no past attempts', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });

    await renderComponent(mockService);

    expect(screen.getByText('Start Quiz')).toBeTruthy();
  });

  // ─── 6. Start phase - Continue button ─────────────────────────────
  it('should show Continue Quiz when unsubmitted attempt exists', async () => {
    const quiz = createMockQuizTakingData();
    const unsubmitted = createMockQuizAttempt({ submitted_at: null });
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [unsubmitted] });

    await renderComponent(mockService);

    expect(screen.getByText('Continue Quiz')).toBeTruthy();
  });

  // ─── 7. Start phase - max attempts reached ────────────────────────
  it('should show Maximum attempts reached when at limit', async () => {
    const quiz = createMockQuizTakingData({ max_attempts: 1 });
    const submitted = createMockQuizAttempt({
      attempt_number: 1,
      submitted_at: '2026-02-12T10:10:00Z',
      score: 50,
      passed: false,
    });
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [submitted] });

    await renderComponent(mockService);

    expect(screen.getByText('Maximum attempts reached')).toBeTruthy();
  });

  // ─── 8. Start phase - past attempts table ─────────────────────────
  it('should show past submitted attempts with scores', async () => {
    const quiz = createMockQuizTakingData({ max_attempts: 3 });
    const attempt1 = createMockQuizAttempt({
      id: 'att-1',
      attempt_number: 1,
      submitted_at: '2026-02-10T10:00:00Z',
      score: 80,
      passed: true,
    });
    const attempt2 = createMockQuizAttempt({
      id: 'att-2',
      attempt_number: 2,
      submitted_at: '2026-02-11T12:00:00Z',
      score: 40,
      passed: false,
    });
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [attempt1, attempt2] });

    await renderComponent(mockService);

    expect(screen.getByText('Previous Attempts')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('Passed')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  // ─── 9. Active phase - questions render ───────────────────────────
  it('should render question components after starting quiz', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );

    const { fixture } = await renderComponent(mockService);

    // Click Start Quiz
    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Quiz has 2 questions, they should both render
    expect(screen.getByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByText('Is the sky blue?')).toBeTruthy();
  });

  // ─── 10. Active phase - answered count ────────────────────────────
  it('should show answered count text in active phase', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Initially 0 of 2 answered
    expect(screen.getByText('0 of 2 answered')).toBeTruthy();
  });

  // ─── 11. Active phase - submit confirmation ──────────────────────
  it('should show confirmation dialog when Submit Quiz clicked', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Click Submit Quiz
    fireEvent.click(screen.getByText('Submit Quiz'));
    fixture.detectChanges();

    // Confirmation dialog should appear
    expect(screen.getByText('Submit quiz?')).toBeTruthy();
    expect(screen.getByText('Yes, Submit')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  // ─── 12. Results phase - passed ───────────────────────────────────
  it('should show passed grade card with score after submission', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );
    const passedResults = createMockQuizResults({
      grade: { score: 90, passed: true, earned_points: 9, total_points: 10 },
      questions: [createMockQuizQuestionResult()],
    });
    mockService.submitQuizAttempt.mockResolvedValue(passedResults);

    const { fixture } = await renderComponent(mockService);

    // Start quiz
    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Submit: click Submit Quiz then confirm
    fireEvent.click(screen.getByText('Submit Quiz'));
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Yes, Submit'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Results should show passed
    expect(screen.getByText('90%')).toBeTruthy();
    expect(screen.getByText('Passed')).toBeTruthy();
    expect(screen.getByText('9 / 10 points')).toBeTruthy();
  });

  // ─── 13. Results phase - failed ───────────────────────────────────
  it('should show failed grade card when quiz not passed', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );
    const failedResults = createMockQuizResults({
      attempt: createMockQuizAttempt({ submitted_at: '2026-02-12T10:10:00Z', score: 30, passed: false }),
      grade: { score: 30, passed: false, earned_points: 3, total_points: 10 },
      questions: [],
    });
    mockService.submitQuizAttempt.mockResolvedValue(failedResults);

    const { fixture } = await renderComponent(mockService);

    // Start, submit, confirm
    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Quiz'));
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Yes, Submit'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('30%')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('3 / 10 points')).toBeTruthy();
  });

  // ─── 14. Results phase - retake button ────────────────────────────
  it('should show Retake Quiz button when attempts remain', async () => {
    const quiz = createMockQuizTakingData({ max_attempts: 3 });
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );
    const results = createMockQuizResults({
      grade: { score: 50, passed: false, earned_points: 5, total_points: 10 },
      questions: [],
    });
    mockService.submitQuizAttempt.mockResolvedValue(results);

    const { fixture } = await renderComponent(mockService);

    // Start, submit, confirm
    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Quiz'));
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Yes, Submit'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Retake Quiz')).toBeTruthy();
  });

  // ─── 15. quizCompleted emission ───────────────────────────────────
  it('should emit quizCompleted when quiz is passed', async () => {
    const quiz = createMockQuizTakingData();
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [] });
    mockService.startQuizAttempt.mockResolvedValue(
      createMockQuizAttempt({ id: 'att-new', started_at: new Date().toISOString() })
    );
    const passedResults = createMockQuizResults({
      grade: { score: 90, passed: true, earned_points: 9, total_points: 10 },
      questions: [],
    });
    mockService.submitQuizAttempt.mockResolvedValue(passedResults);

    const { fixture, quizCompletedSpy } = await renderComponent(mockService);

    // Start, submit, confirm
    fireEvent.click(screen.getByText('Start Quiz'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Quiz'));
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Yes, Submit'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(quizCompletedSpy).toHaveBeenCalled();
  });

  // ─── 16. View Results on past attempt ─────────────────────────────
  it('should load and show results when clicking View on a past attempt', async () => {
    const quiz = createMockQuizTakingData();
    const pastAttempt = createMockQuizAttempt({
      id: 'att-past',
      attempt_number: 1,
      submitted_at: '2026-02-10T10:00:00Z',
      score: 75,
      passed: true,
    });
    mockService.loadQuizForTaking.mockResolvedValue({ quiz, pastAttempts: [pastAttempt] });

    const viewResults = createMockQuizResults({
      attempt: pastAttempt,
      grade: { score: 75, passed: true, earned_points: 3, total_points: 4 },
      questions: [createMockQuizQuestionResult({ question_id: 'q-1', question_text: 'What is 2 + 2?' })],
    });
    mockService.getQuizAttemptResults.mockResolvedValue(viewResults);

    const { fixture } = await renderComponent(mockService);

    // Past attempt should be in the table
    expect(screen.getByText('75%')).toBeTruthy();

    // Click View button
    fireEvent.click(screen.getByText('View'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Should call getQuizAttemptResults with the attempt id
    expect(mockService.getQuizAttemptResults).toHaveBeenCalledWith('att-past');

    // Results phase should now show
    expect(screen.getByText('3 / 4 points')).toBeTruthy();
    expect(screen.getByText('Question Results')).toBeTruthy();
  });
});
