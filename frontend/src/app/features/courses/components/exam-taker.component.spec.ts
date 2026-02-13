import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { ExamTakerComponent } from './exam-taker.component';
import { CourseService } from '../../../core/services/course.service';
import {
  createMockCourseService,
  createMockExamTakingData,
  createMockExamSubmission,
  createMockModuleViewerData,
  MockCourseService,
} from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';

describe('ExamTakerComponent', () => {
  let mockService: MockCourseService;

  beforeEach(() => {
    mockService = createMockCourseService();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderComponent = async (service: MockCourseService) => {
    const examCompletedSpy = vi.fn();
    const result = await render(ExamTakerComponent, {
      componentInputs: { moduleId: 'mod-1' },
      componentImports: [MockLucideIconComponent, FileUploadComponent],
      providers: [
        { provide: CourseService, useValue: service },
      ],
      on: { examCompleted: examCompletedSpy },
    });

    // Flush the effect
    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, examCompletedSpy };
  };

  // ─── 1. Loading state ─────────────────────────────────────────────
  it('should show loading skeleton initially before effect fires', async () => {
    mockService.loadExamForTaking.mockReturnValue(new Promise(() => {}));

    await render(ExamTakerComponent, {
      componentInputs: { moduleId: 'mod-1' },
      componentImports: [MockLucideIconComponent, FileUploadComponent],
      providers: [{ provide: CourseService, useValue: mockService }],
    });

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  // ─── 2. Error state ──────────────────────────────────────────────
  it('should show error when loadExamForTaking fails', async () => {
    mockService.loadExamForTaking.mockRejectedValue(new Error('Network error'));

    await renderComponent(mockService);

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  // ─── 3. Exam not found ──────────────────────────────────────────
  it('should show error when loadExamForTaking returns null', async () => {
    mockService.loadExamForTaking.mockResolvedValue(null);

    await renderComponent(mockService);

    expect(screen.getByText('Exam not found')).toBeTruthy();
  });

  // ─── 4. Info phase - exam metadata ──────────────────────────────
  it('should show exam metadata in info phase', async () => {
    const exam = createMockExamTakingData({
      duration_minutes: 90,
      passing_score: 75,
      allowed_file_types: ['application/pdf', 'application/zip'],
      max_file_size: 52428800,
    });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    await renderComponent(mockService);

    expect(screen.getByText('90 min')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('PDF, ZIP')).toBeTruthy();
    expect(screen.getByText('50 MB')).toBeTruthy();
  });

  // ─── 5. Info phase - Start Exam button ──────────────────────────
  it('should show Start Exam button when no submission', async () => {
    const exam = createMockExamTakingData();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    await renderComponent(mockService);

    expect(screen.getByText('Start Exam')).toBeTruthy();
  });

  // ─── 6. Info phase - existing submission → submitted ────────────
  it('should skip to submitted phase when submission exists', async () => {
    const exam = createMockExamTakingData();
    const submission = createMockExamSubmission();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission });

    await renderComponent(mockService);

    expect(screen.queryByText('Start Exam')).toBeNull();
    expect(screen.getByText('Submission Details')).toBeTruthy();
  });

  // ─── 7. Active phase - timer displays ─────────────────────────
  it('should show timer after starting exam', async () => {
    const exam = createMockExamTakingData({ duration_minutes: 60 });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    // Timer should show some time remaining (close to 60:00)
    const timerEl = document.querySelector('.tabular-nums');
    expect(timerEl).toBeTruthy();
    expect(timerEl!.textContent).toMatch(/\d{2}:\d{2}/);
  });

  // ─── 8. Active phase - download button visible ────────────────
  it('should show download button when exam_file_url is set', async () => {
    const exam = createMockExamTakingData({ exam_file_url: 'https://example.com/exam.pdf' });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    expect(screen.getByText('Download Exam File')).toBeTruthy();
  });

  // ─── 9. Active phase - no download button ─────────────────────
  it('should not show download button when exam_file_url is null', async () => {
    const exam = createMockExamTakingData({ exam_file_url: null });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    expect(screen.queryByText('Download Exam File')).toBeNull();
  });

  // ─── 10. Active phase - file upload renders ───────────────────
  it('should render file upload component in active phase', async () => {
    const exam = createMockExamTakingData();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    expect(document.querySelector('app-file-upload')).toBeTruthy();
    expect(screen.getByText('Your Submission')).toBeTruthy();
  });

  // ─── 11. Active phase - submit disabled without file ──────────
  it('should disable submit button when no file selected', async () => {
    const exam = createMockExamTakingData();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    const submitBtn = screen.getByText('Submit Exam');
    expect(submitBtn.closest('button')!.hasAttribute('disabled')).toBe(true);
  });

  // ─── 12. Active phase - submit confirmation ──────────────────
  it('should show confirmation dialog when Submit Exam clicked with file', async () => {
    const exam = createMockExamTakingData();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    // Simulate file selection by directly setting the signal
    fixture.componentInstance.selectedFile.set(new File(['test'], 'test.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Exam'));
    fixture.detectChanges();

    expect(screen.getByText('Submit your exam?')).toBeTruthy();
    expect(screen.getByText('Yes, Submit')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  // ─── 13. Active phase - successful submission ────────────────
  it('should transition to submitted phase after successful submission', async () => {
    const exam = createMockExamTakingData();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });
    // Set moduleViewer so courseId is available
    mockService._setModuleViewer(createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Exam', description: null, module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'course-1' },
    }));
    mockService.submitExamSubmission.mockResolvedValue(createMockExamSubmission());

    const { fixture, examCompletedSpy } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    // Set file and submit
    fixture.componentInstance.selectedFile.set(new File(['test'], 'test.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Exam'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Yes, Submit'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Submission Details')).toBeTruthy();
    expect(examCompletedSpy).toHaveBeenCalled();
  });

  // ─── 14. Active phase - submission error ─────────────────────
  it('should show error on submission failure', async () => {
    const exam = createMockExamTakingData();
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission: null });
    mockService._setModuleViewer(createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Exam', description: null, module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'course-1' },
    }));
    mockService.submitExamSubmission.mockRejectedValue(new Error('Upload failed'));

    const { fixture } = await renderComponent(mockService);

    fireEvent.click(screen.getByText('Start Exam'));
    fixture.detectChanges();

    fixture.componentInstance.selectedFile.set(new File(['test'], 'test.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Exam'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Yes, Submit'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Upload failed')).toBeTruthy();
  });

  // ─── 15. Submitted phase - ungraded ──────────────────────────
  it('should show awaiting grading for ungraded submission', async () => {
    const exam = createMockExamTakingData();
    const submission = createMockExamSubmission({ score: null, feedback: null });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission });

    await renderComponent(mockService);

    expect(screen.getByText('Awaiting grading')).toBeTruthy();
    expect(screen.getByText('Your submission is being reviewed by a lecturer.')).toBeTruthy();
  });

  // ─── 16. Submitted phase - graded and passed ─────────────────
  it('should show passed badge when graded and passed', async () => {
    const exam = createMockExamTakingData({ passing_score: 70 });
    const submission = createMockExamSubmission({ score: 85, feedback: null });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission });

    await renderComponent(mockService);

    expect(screen.getByText('85%')).toBeTruthy();
    expect(screen.getByText('Passed')).toBeTruthy();
  });

  // ─── 17. Submitted phase - graded and failed ─────────────────
  it('should show failed badge when graded and failed', async () => {
    const exam = createMockExamTakingData({ passing_score: 70 });
    const submission = createMockExamSubmission({ score: 50, feedback: null });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission });

    await renderComponent(mockService);

    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  // ─── 18. Submitted phase - feedback displayed ────────────────
  it('should display feedback when graded', async () => {
    const exam = createMockExamTakingData({ passing_score: 70 });
    const submission = createMockExamSubmission({
      score: 90,
      feedback: 'Excellent work on the analysis section.',
    });
    mockService.loadExamForTaking.mockResolvedValue({ exam, submission });

    await renderComponent(mockService);

    expect(screen.getByText('Feedback')).toBeTruthy();
    expect(screen.getByText('Excellent work on the analysis section.')).toBeTruthy();
  });
});
