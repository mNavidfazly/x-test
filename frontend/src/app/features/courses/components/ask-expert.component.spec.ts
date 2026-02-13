import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { AskExpertComponent } from './ask-expert.component';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { createMockExpertQuestionService } from '../../../__mocks__/course.mock';

describe('AskExpertComponent', () => {
  const renderAskExpert = async (options?: {
    courseId?: string;
    moduleId?: string;
    mockService?: ReturnType<typeof createMockExpertQuestionService>;
  }) => {
    const mockService = options?.mockService ?? createMockExpertQuestionService();

    const result = await render(AskExpertComponent, {
      componentInputs: {
        courseId: options?.courseId ?? 'course-1',
        moduleId: options?.moduleId ?? 'mod-1',
      },
      providers: [
        { provide: ExpertQuestionService, useValue: mockService },
      ],
    });

    return { ...result, mockService };
  };

  it('should show "Ask an Expert" button initially', async () => {
    await renderAskExpert();
    expect(screen.getByText('Ask an Expert')).toBeTruthy();
  });

  it('should expand form when button is clicked', async () => {
    await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    expect(screen.getByPlaceholderText('Type your question...')).toBeTruthy();
    expect(screen.getByText('Send Question')).toBeTruthy();
  });

  it('should show context text about sending to experts', async () => {
    await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    expect(screen.getByText(/Your question will be sent to the course expert/)).toBeTruthy();
  });

  it('should disable submit when textarea is empty', async () => {
    await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    const submitBtn = screen.getByText('Send Question');
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('should call askQuestion on submit with correct params', async () => {
    const { mockService, fixture } = await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    const textarea = screen.getByPlaceholderText('Type your question...');
    fireEvent.input(textarea, { target: { value: 'How does this work?' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Send Question'));
    await new Promise(r => setTimeout(r));

    expect(mockService.askQuestion).toHaveBeenCalledWith('course-1', 'mod-1', 'How does this work?');
  });

  it('should show success message after successful submission', async () => {
    const { fixture } = await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    const textarea = screen.getByPlaceholderText('Type your question...');
    fireEvent.input(textarea, { target: { value: 'My question' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Send Question'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText(/Your question has been sent/)).toBeTruthy();
  });

  it('should show error message on submit failure', async () => {
    const mockService = createMockExpertQuestionService();
    mockService.askQuestion.mockRejectedValueOnce(new Error('Network error'));

    const { fixture } = await renderAskExpert({ mockService });

    fireEvent.click(screen.getByText('Ask an Expert'));

    const textarea = screen.getByPlaceholderText('Type your question...');
    fireEvent.input(textarea, { target: { value: 'My question' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Send Question'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('should allow asking another question after success', async () => {
    const { fixture } = await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    const textarea = screen.getByPlaceholderText('Type your question...');
    fireEvent.input(textarea, { target: { value: 'My question' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Send Question'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Ask another question')).toBeTruthy();
    fireEvent.click(screen.getByText('Ask another question'));
    fixture.detectChanges();

    // Back to initial button state
    expect(screen.getByText('Ask an Expert')).toBeTruthy();
  });

  it('should close form when X is clicked', async () => {
    const { fixture } = await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));
    expect(screen.getByPlaceholderText('Type your question...')).toBeTruthy();

    // The X button is inside the form header
    const closeBtn = fixture.nativeElement.querySelector('button[type="button"]:nth-child(2)') as HTMLElement;
    // Actually, let's find the button with X icon by looking for the header area
    const headerDiv = screen.getByText('Ask an Expert').closest('div');
    const xButton = headerDiv?.querySelector('button:last-child');
    if (xButton) {
      fireEvent.click(xButton);
      fixture.detectChanges();
    }

    // Should be back to button state — but text "Ask an Expert" is always present as heading or button
    // Check that textarea is gone
    expect(screen.queryByPlaceholderText('Type your question...')).toBeNull();
  });

  it('should not submit when text is only whitespace', async () => {
    const { mockService, fixture } = await renderAskExpert();

    fireEvent.click(screen.getByText('Ask an Expert'));

    const textarea = screen.getByPlaceholderText('Type your question...');
    fireEvent.input(textarea, { target: { value: '   ' } });
    fixture.detectChanges();

    const submitBtn = screen.getByText('Send Question');
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(submitBtn);
    await new Promise(r => setTimeout(r));

    expect(mockService.askQuestion).not.toHaveBeenCalled();
  });
});
