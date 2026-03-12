import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { KnowledgeCheckSectionComponent } from './knowledge-check-section.component';
import { KnowledgeCheckService } from '../../../core/services/knowledge-check.service';
import { createMockKnowledgeCheckService, createMockKnowledgeCheckQuestion } from '../../../__mocks__/knowledge-check.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { KnowledgeCheckResponse } from '../../../core/models/knowledge-check.model';
import { XpAnimationService } from '../../../core/services/xp-animation.service';
import { createMockXpAnimationService } from '../../../__mocks__/xp-animation.mock';

describe('KnowledgeCheckSectionComponent', () => {
  let mockService: ReturnType<typeof createMockKnowledgeCheckService>;

  beforeEach(() => {
    mockService = createMockKnowledgeCheckService();
  });

  const renderSection = async (inputs?: { moduleId?: string }) => {
    const result = await render(KnowledgeCheckSectionComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        moduleId: inputs?.moduleId ?? 'mod-1',
      },
      providers: [
        { provide: KnowledgeCheckService, useValue: mockService },
        { provide: XpAnimationService, useValue: createMockXpAnimationService() },
      ],
    });

    // Flush effect → async loadData
    await new Promise((r) => setTimeout(r));
    result.fixture.detectChanges();

    return result;
  };

  it('should show nothing when no questions', async () => {
    mockService.loadQuestions.mockResolvedValue([]);
    mockService.loadMyResponses.mockResolvedValue(new Map());

    const { container } = await renderSection();

    expect(container.querySelector('.card')).toBeNull();
  });

  it('should render questions with header when loaded', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1', questionText: 'What is 2+2?' }),
      createMockKnowledgeCheckQuestion({ id: 'q2', questionText: 'Is Earth round?', questionType: 'true_false', options: [{ text: 'True' }, { text: 'False' }] }),
    ]);
    mockService.loadMyResponses.mockResolvedValue(new Map());

    await renderSection();

    expect(screen.getByText('Check Your Understanding')).toBeTruthy();
    expect(screen.getByText('What is 2+2?')).toBeTruthy();
    expect(screen.getByText('Is Earth round?')).toBeTruthy();
    expect(screen.getByText('0 of 2 answered')).toBeTruthy();
  });

  it('should show selectable radio options for unanswered questions', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1', options: [{ text: 'Option A' }, { text: 'Option B' }, { text: 'Option C' }] }),
    ]);
    mockService.loadMyResponses.mockResolvedValue(new Map());

    await renderSection();

    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('Option B')).toBeTruthy();
    expect(screen.getByText('Option C')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('should enable Check button after selecting an option', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1', options: [{ text: 'A' }, { text: 'B' }] }),
    ]);
    mockService.loadMyResponses.mockResolvedValue(new Map());

    const { fixture } = await renderSection();

    // No Check button initially
    expect(screen.queryByText('Check')).toBeNull();

    // Select an option
    const user = userEvent.setup();
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    fixture.detectChanges();

    expect(screen.getByText('Check')).toBeTruthy();
  });

  it('should submit answer and show feedback', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1', options: [{ text: 'Right' }, { text: 'Wrong' }] }),
    ]);
    mockService.loadMyResponses.mockResolvedValue(new Map());
    mockService.submitAnswer.mockResolvedValue({
      questionId: 'q1',
      selectedOptionIndex: 0,
      isCorrect: true,
      correctIndex: 0,
      explanation: 'Correct!',
    } satisfies KnowledgeCheckResponse);

    const { fixture } = await renderSection();

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('radio')[0]);
    fixture.detectChanges();
    await user.click(screen.getByText('Check'));

    // Wait for async submission
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();

    expect(mockService.submitAnswer).toHaveBeenCalledWith('q1', 0);
    // Explanation should show
    expect(screen.getByText('Correct!')).toBeTruthy();
    expect(screen.getByText('1 of 1 answered')).toBeTruthy();
  });

  it('should show previously answered questions from responses', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1', options: [{ text: 'A' }, { text: 'B' }] }),
    ]);
    const responsesMap = new Map<string, KnowledgeCheckResponse>();
    responsesMap.set('q1', {
      questionId: 'q1',
      selectedOptionIndex: 1,
      isCorrect: false,
      correctIndex: 0,
      explanation: 'A was correct.',
    });
    mockService.loadMyResponses.mockResolvedValue(responsesMap);

    await renderSection();

    // Should show explanation and 1 of 1 answered
    expect(screen.getByText('A was correct.')).toBeTruthy();
    expect(screen.getByText('1 of 1 answered')).toBeTruthy();
    // Should NOT show radio buttons (already answered)
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('should show progress bar', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1' }),
      createMockKnowledgeCheckQuestion({ id: 'q2' }),
    ]);
    const responsesMap = new Map<string, KnowledgeCheckResponse>();
    responsesMap.set('q1', { questionId: 'q1', selectedOptionIndex: 0, isCorrect: true, correctIndex: 0, explanation: null });
    mockService.loadMyResponses.mockResolvedValue(responsesMap);

    const { container } = await renderSection();

    expect(screen.getByText('1 of 2 answered')).toBeTruthy();
    const progressFill = container.querySelector('.progress-fill') as HTMLElement;
    expect(progressFill).toBeTruthy();
    expect(progressFill.style.width).toBe('50%');
  });

  it('should show congratulatory message when all answered', async () => {
    mockService.loadQuestions.mockResolvedValue([
      createMockKnowledgeCheckQuestion({ id: 'q1' }),
    ]);
    const responsesMap = new Map<string, KnowledgeCheckResponse>();
    responsesMap.set('q1', { questionId: 'q1', selectedOptionIndex: 0, isCorrect: true, correctIndex: 0, explanation: null });
    mockService.loadMyResponses.mockResolvedValue(responsesMap);

    await renderSection();

    expect(screen.getByText(/completed all knowledge checks/)).toBeTruthy();
  });
});
