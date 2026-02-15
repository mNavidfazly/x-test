import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { FormsModule } from '@angular/forms';
import { ExternalQuizFormComponent } from './external-quiz-form.component';
import { createMockModuleFormData, createMockExternalQuizFormData } from '../../../__mocks__/course.mock';

async function renderForm(options?: {
  isEditMode?: boolean;
  moduleOverrides?: Parameters<typeof createMockModuleFormData>[0];
  quizOverrides?: Parameters<typeof createMockExternalQuizFormData>[0];
}) {
  const moduleData = createMockModuleFormData({
    module_type: 'external_quiz',
    ...options?.moduleOverrides,
  });
  const quizData = createMockExternalQuizFormData(options?.quizOverrides);

  return render(ExternalQuizFormComponent, {
    componentImports: [FormsModule],
    componentInputs: {
      initialModuleData: moduleData,
      initialExternalQuizData: quizData,
      isEditMode: options?.isEditMode ?? false,
    },
  });
}

describe('ExternalQuizFormComponent', () => {
  it('should render title and description fields', async () => {
    await renderForm();

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should render external quiz settings section', async () => {
    await renderForm();

    expect(screen.getByText('External Quiz Settings')).toBeTruthy();
    expect(screen.getByLabelText('Quiz ID')).toBeTruthy();
    expect(screen.getByLabelText('Quiz URL')).toBeTruthy();
    expect(screen.getByLabelText('Passing Score (%)')).toBeTruthy();
  });

  it('should pre-fill form data from inputs', async () => {
    await renderForm({
      moduleOverrides: { title: 'My External Quiz', description: 'Test desc' },
      quizOverrides: {
        external_quiz_id: 'EXT-001',
        external_quiz_url: 'https://quiz.example.com/1',
        passing_score: 80,
      },
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My External Quiz');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Test desc');
    expect((screen.getByLabelText('Quiz ID') as HTMLInputElement).value).toBe('EXT-001');
    expect((screen.getByLabelText('Quiz URL') as HTMLInputElement).value).toBe('https://quiz.example.com/1');
    expect((screen.getByLabelText('Passing Score (%)') as HTMLInputElement).value).toBe('80');
  });

  it('should show "Create Module" button in create mode', async () => {
    await renderForm({ isEditMode: false });

    expect(screen.getByText('Create Module')).toBeTruthy();
    expect(screen.queryByText('Save Changes')).toBeNull();
  });

  it('should show "Save Changes" button in edit mode', async () => {
    await renderForm({ isEditMode: true });

    expect(screen.getByText('Save Changes')).toBeTruthy();
    expect(screen.queryByText('Create Module')).toBeNull();
  });

  it('should disable save when title is empty', async () => {
    await renderForm({
      moduleOverrides: { title: '' },
      quizOverrides: { external_quiz_id: 'EXT-1', external_quiz_url: 'https://quiz.com' },
    });

    const btn = screen.getByText('Create Module') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should disable save when quiz ID is empty', async () => {
    await renderForm({
      moduleOverrides: { title: 'My Quiz' },
      quizOverrides: { external_quiz_id: '', external_quiz_url: 'https://quiz.com' },
    });

    const btn = screen.getByText('Create Module') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should disable save when quiz URL is empty', async () => {
    await renderForm({
      moduleOverrides: { title: 'My Quiz' },
      quizOverrides: { external_quiz_id: 'EXT-1', external_quiz_url: '' },
    });

    const btn = screen.getByText('Create Module') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should emit save with correct payload', async () => {
    const { fixture } = await renderForm({
      moduleOverrides: { title: 'Quiz Module', description: 'Desc', lecture_id: 'l1' },
      quizOverrides: { external_quiz_id: 'EXT-99', external_quiz_url: 'https://q.com/99', passing_score: 75 },
    });

    const component = fixture.componentInstance;
    let emittedPayload: unknown = null;
    component.save.subscribe((val: unknown) => { emittedPayload = val; });

    fireEvent.click(screen.getByText('Create Module'));

    expect(emittedPayload).toEqual({
      module: {
        title: 'Quiz Module',
        description: 'Desc',
        module_type: 'external_quiz',
        lecture_id: 'l1',
        estimated_duration_minutes: 15,
      },
      content: {
        type: 'external_quiz',
        data: { external_quiz_id: 'EXT-99', external_quiz_url: 'https://q.com/99', passing_score: 75 },
      },
    });
  });

  it('should emit cancel when Cancel clicked', async () => {
    const { fixture } = await renderForm();

    const component = fixture.componentInstance;
    let cancelled = false;
    component.cancel.subscribe(() => { cancelled = true; });

    fireEvent.click(screen.getByText('Cancel'));

    expect(cancelled).toBe(true);
  });

  it('should show helper text for passing score', async () => {
    await renderForm();

    expect(screen.getByText('Leave blank for no minimum passing score')).toBeTruthy();
  });
});
