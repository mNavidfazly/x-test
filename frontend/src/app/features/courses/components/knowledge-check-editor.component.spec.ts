import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { KnowledgeCheckEditorComponent } from './knowledge-check-editor.component';
import { KnowledgeCheckService } from '../../../core/services/knowledge-check.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { createMockKnowledgeCheckService } from '../../../__mocks__/knowledge-check.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { createMockConfirmDialogService } from '../../../__mocks__/confirm-dialog.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FormsModule } from '@angular/forms';
import { KnowledgeCheckQuestion } from '../../../core/models/knowledge-check.model';

describe('KnowledgeCheckEditorComponent', () => {
  let mockService: ReturnType<typeof createMockKnowledgeCheckService>;
  let mockToast: ReturnType<typeof createMockToastService>;
  let mockConfirm: ReturnType<typeof createMockConfirmDialogService>;

  beforeEach(() => {
    mockService = createMockKnowledgeCheckService();
    mockToast = createMockToastService();
    mockConfirm = createMockConfirmDialogService();
  });

  const renderEditor = async (inputs?: { moduleId?: string }) => {
    const result = await render(KnowledgeCheckEditorComponent, {
      componentImports: [MockLucideIconComponent, FormsModule],
      componentInputs: {
        moduleId: inputs?.moduleId ?? 'mod-1',
      },
      providers: [
        { provide: KnowledgeCheckService, useValue: mockService },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmDialogService, useValue: mockConfirm },
      ],
    });

    // Flush effect → async loadQuestions (two cycles for effect + async resolution)
    await new Promise((r) => setTimeout(r));
    result.fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
    result.fixture.detectChanges();

    return result;
  };

  it('should load existing questions on init', async () => {
    const existing: KnowledgeCheckQuestion[] = [
      { id: 'q1', moduleId: 'mod-1', questionText: 'Loaded Q?', questionType: 'single_choice', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }], explanation: null, orderIndex: 0 },
    ];
    mockService.loadQuestionsForEdit.mockResolvedValue(existing);

    await renderEditor();

    expect(mockService.loadQuestionsForEdit).toHaveBeenCalledWith('mod-1');
    expect(screen.getByDisplayValue('Loaded Q?')).toBeTruthy();
  });

  it('should show empty state when no questions', async () => {
    mockService.loadQuestionsForEdit.mockResolvedValue([]);

    await renderEditor();

    expect(screen.getByText(/No knowledge check questions yet/)).toBeTruthy();
  });

  it('should add a new question', async () => {
    mockService.loadQuestionsForEdit.mockResolvedValue([]);

    await renderEditor();

    const user = userEvent.setup();
    await user.click(screen.getByText('Add Question'));

    // Should now have a question form with Q1 label
    expect(screen.getByText('Q1')).toBeTruthy();
  });

  it('should remove a question', async () => {
    const existing: KnowledgeCheckQuestion[] = [
      { id: 'q1', moduleId: 'mod-1', questionText: 'First Q?', questionType: 'single_choice', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }], explanation: null, orderIndex: 0 },
      { id: 'q2', moduleId: 'mod-1', questionText: 'Second Q?', questionType: 'true_false', options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }], explanation: null, orderIndex: 1 },
    ];
    mockService.loadQuestionsForEdit.mockResolvedValue(existing);

    await renderEditor();

    expect(screen.getByDisplayValue('First Q?')).toBeTruthy();
    expect(screen.getByDisplayValue('Second Q?')).toBeTruthy();

    // Click first delete button
    const user = userEvent.setup();
    const deleteButtons = screen.getAllByTitle('Delete question');
    await user.click(deleteButtons[0]);

    expect(screen.queryByDisplayValue('First Q?')).toBeNull();
    expect(screen.getByDisplayValue('Second Q?')).toBeTruthy();
  });

  it('should change question type and reset options', async () => {
    const existing: KnowledgeCheckQuestion[] = [
      { id: 'q1', moduleId: 'mod-1', questionText: 'Q?', questionType: 'single_choice', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }, { text: 'C', isCorrect: false }], explanation: null, orderIndex: 0 },
    ];
    mockService.loadQuestionsForEdit.mockResolvedValue(existing);

    const { fixture } = await renderEditor();

    // Change type to true_false via component method
    fixture.componentInstance.onTypeChange(0, 'true_false');
    fixture.detectChanges();

    expect(fixture.componentInstance.questions[0].options).toHaveLength(2);
    expect(fixture.componentInstance.questions[0].options[0].text).toBe('True');
  });

  it('should reorder questions with move buttons', async () => {
    const existing: KnowledgeCheckQuestion[] = [
      { id: 'q1', moduleId: 'mod-1', questionText: 'First', questionType: 'true_false', options: [{ text: 'T', isCorrect: true }, { text: 'F', isCorrect: false }], explanation: null, orderIndex: 0 },
      { id: 'q2', moduleId: 'mod-1', questionText: 'Second', questionType: 'true_false', options: [{ text: 'T', isCorrect: true }, { text: 'F', isCorrect: false }], explanation: null, orderIndex: 1 },
    ];
    mockService.loadQuestionsForEdit.mockResolvedValue(existing);

    const { fixture } = await renderEditor();

    // Move first question down
    fixture.componentInstance.moveQuestion(0, 1);
    fixture.detectChanges();

    expect(fixture.componentInstance.questions[0].questionText).toBe('Second');
    expect(fixture.componentInstance.questions[1].questionText).toBe('First');
  });

  it('should validate correctly', async () => {
    mockService.loadQuestionsForEdit.mockResolvedValue([]);

    const { fixture } = await renderEditor();

    // Empty is valid (allows clearing all questions)
    expect(fixture.componentInstance.isValid()).toBe(true);

    // Add invalid question (no text)
    fixture.componentInstance.addQuestion();
    expect(fixture.componentInstance.isValid()).toBe(false);

    // Fill in question text and set a correct answer
    fixture.componentInstance.questions[0].questionText = 'Valid Q?';
    fixture.componentInstance.questions[0].options = [
      { text: 'A', isCorrect: true },
      { text: 'B', isCorrect: false },
    ];
    expect(fixture.componentInstance.isValid()).toBe(true);
  });

  it('should call saveQuestions on save', async () => {
    const existing: KnowledgeCheckQuestion[] = [
      { id: 'q1', moduleId: 'mod-1', questionText: 'Q?', questionType: 'single_choice', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }], explanation: null, orderIndex: 0 },
    ];
    mockService.loadQuestionsForEdit.mockResolvedValue(existing);

    const { fixture } = await renderEditor();

    const user = userEvent.setup();
    await user.click(screen.getByText('Save Knowledge Checks'));

    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();

    expect(mockService.saveQuestions).toHaveBeenCalledWith('mod-1', expect.any(Array));
    expect(mockToast.success).toHaveBeenCalledWith('Knowledge checks saved successfully');
  });

  it('should render Template and Import buttons', async () => {
    mockService.loadQuestionsForEdit.mockResolvedValue([]);

    await renderEditor();

    expect(screen.getByText('Template')).toBeTruthy();
    expect(screen.getByText('Import')).toBeTruthy();
  });

  it('should render Export button when questions exist', async () => {
    const existing: KnowledgeCheckQuestion[] = [
      { id: 'q1', moduleId: 'mod-1', questionText: 'Q?', questionType: 'true_false', options: [{ text: 'T', isCorrect: true }, { text: 'F', isCorrect: false }], explanation: null, orderIndex: 0 },
    ];
    mockService.loadQuestionsForEdit.mockResolvedValue(existing);

    await renderEditor();

    expect(screen.getByText('Export')).toBeTruthy();
  });

  it('should show import error for invalid JSON', async () => {
    mockService.loadQuestionsForEdit.mockResolvedValue([]);

    const { fixture } = await renderEditor();

    fixture.componentInstance.importError = 'Missing or invalid "questions" array.';
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    expect(screen.getByText(/Missing or invalid/)).toBeTruthy();
  });
});
