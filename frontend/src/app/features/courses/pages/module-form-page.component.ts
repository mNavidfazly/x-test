import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ArrowLeft, Loader2, Clock, Video, FileText, Type, HelpCircle, ClipboardCheck, ExternalLink, Headphones, FolderArchive, LucideIconData } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { VideoFormComponent } from '../components/video-form.component';
import { PdfFormComponent } from '../components/pdf-form.component';
import { ExamFormComponent } from '../components/exam-form.component';
import { MarkdownFormComponent } from '../components/markdown-form.component';
import { QuizFormComponent } from '../components/quiz-form.component';
import { ExternalQuizFormComponent } from '../components/external-quiz-form.component';
import { AudioFormComponent } from '../components/audio-form.component';
import { DownloadFormComponent } from '../components/download-form.component';
import { ModuleFilesEditorComponent } from '../components/module-files-editor.component';
import { ModuleType, ModuleFormData, VideoFormData, PdfFormData, ExamFormData, MarkdownFormData, QuizFormData, ExternalQuizFormData, AudioFormData, DownloadFormData, ModuleSavePayload } from '../../../core/models/course.model';

interface TypeOption {
  value: ModuleType;
  label: string;
  hint: string;
  icon: LucideIconData;
}

@Component({
  selector: 'app-module-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, LucideAngularModule, VideoFormComponent, PdfFormComponent, ExamFormComponent, MarkdownFormComponent, QuizFormComponent, ExternalQuizFormComponent, AudioFormComponent, DownloadFormComponent, ModuleFilesEditorComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-2xl">
      <a [routerLink]="['/courses', courseId()]" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
        Back to course
      </a>

      <h1 class="page-title mb-6">
        {{ isEditMode() ? 'Edit Module' : 'New Module' }}
      </h1>

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
          Loading...
        </div>
      } @else if (errorMessage()) {
        <div class="alert-error rounded-lg mb-4">
          {{ errorMessage() }}
        </div>
      } @else {
        <!-- Type selector (create mode only, before type is chosen) -->
        @if (!isEditMode() && !selectedType()) {
          <div>
            <p class="text-sm text-slate-600 mb-4">Choose a module type:</p>
            <div class="grid grid-cols-2 gap-3">
              @for (opt of availableTypes; track opt.value) {
                <button
                  type="button"
                  (click)="selectType(opt.value)"
                  class="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/30 transition-all duration-200 text-left"
                >
                  <lucide-icon [img]="opt.icon" [size]="20" class="text-slate-500 shrink-0"></lucide-icon>
                  <div>
                    <div class="text-sm font-semibold text-slate-900">{{ opt.label }}</div>
                    <div class="text-xs text-slate-500">{{ opt.hint }}</div>
                  </div>
                </button>
              }
            </div>
          </div>
        }

        <!-- Significant update checkbox (edit mode only) -->
        @if (isEditMode() && selectedType()) {
          <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <label class="flex items-center gap-2 text-sm text-amber-800 cursor-pointer">
              <input
                type="checkbox"
                [checked]="significantUpdate()"
                (change)="significantUpdate.set($any($event.target).checked)"
                class="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span class="font-medium">This is a significant update</span>
            </label>
            <p class="text-xs text-amber-600 mt-1 ml-6">Resets learner progress for this module. Use for content changes, not typo fixes.</p>
          </div>
        }

        <!-- Estimated Duration (shown once a type is selected) -->
        @if (selectedType()) {
          <div class="mb-4">
            <label class="form-label flex items-center gap-1.5 mb-1">
              <lucide-icon [img]="icons.Clock" [size]="14" class="text-slate-400"></lucide-icon>
              Estimated Duration (minutes)
            </label>
            <input
              type="number"
              class="input-field w-32"
              [ngModel]="estimatedDuration()"
              (ngModelChange)="estimatedDuration.set($event)"
              min="1"
              max="999"
              placeholder="15"
            />
            <p class="text-xs text-slate-400 mt-1">How long this module takes to complete.</p>
          </div>
        }

        <!-- Video form -->
        @if (selectedType() === 'video') {
          <app-video-form
            [initialModuleData]="moduleFormData()"
            [initialVideoData]="videoFormData()"
            [isEditMode]="isEditMode()"
            [courseId]="courseId()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- PDF form -->
        @if (selectedType() === 'pdf') {
          <app-pdf-form
            [initialModuleData]="moduleFormData()"
            [initialPdfData]="pdfFormData()"
            [isEditMode]="isEditMode()"
            [courseId]="courseId()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- Exam form -->
        @if (selectedType() === 'exam') {
          <app-exam-form
            [initialModuleData]="moduleFormData()"
            [initialExamData]="examFormData()"
            [isEditMode]="isEditMode()"
            [courseId]="courseId()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- Markdown form -->
        @if (selectedType() === 'markdown') {
          <app-markdown-form
            [initialModuleData]="moduleFormData()"
            [initialMarkdownData]="markdownFormData()"
            [isEditMode]="isEditMode()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- Quiz form -->
        @if (selectedType() === 'quiz') {
          <app-quiz-form
            [initialModuleData]="moduleFormData()"
            [initialQuizData]="quizFormData()"
            [isEditMode]="isEditMode()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- External Quiz form -->
        @if (selectedType() === 'external_quiz') {
          <app-external-quiz-form
            [initialModuleData]="moduleFormData()"
            [initialExternalQuizData]="externalQuizFormData()"
            [isEditMode]="isEditMode()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- Audio form -->
        @if (selectedType() === 'audio') {
          <app-audio-form
            [initialModuleData]="moduleFormData()"
            [initialAudioData]="audioFormData()"
            [isEditMode]="isEditMode()"
            [courseId]="courseId()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- Download form -->
        @if (selectedType() === 'download') {
          <app-download-form
            [initialModuleData]="moduleFormData()"
            [initialDownloadData]="downloadFormData()"
            [isEditMode]="isEditMode()"
            [courseId]="courseId()"
            (save)="onSave($event)"
            (cancel)="onCancel()"
          />
        }

        <!-- Module files editor (edit mode only, all types) -->
        @if (isEditMode() && moduleId()) {
          <app-module-files-editor
            [moduleId]="moduleId()"
            [courseId]="courseId()"
          />
        }
      }
    </div>
  `,
})
export class ModuleFormPageComponent implements OnInit {
  #courseService = inject(CourseService);
  #auth = inject(AuthService);
  #toast = inject(ToastService);
  #route = inject(ActivatedRoute);
  #router = inject(Router);

  readonly icons = { ArrowLeft, Loader2, Clock };

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly selectedType = signal<ModuleType | null>(null);
  readonly significantUpdate = signal(false);
  readonly estimatedDuration = signal(15);

  readonly courseId = computed(() => this.#route.snapshot.paramMap.get('courseId') ?? '');
  readonly moduleId = computed(() => this.#route.snapshot.paramMap.get('moduleId') ?? '');
  readonly isEditMode = computed(() => !!this.moduleId());
  readonly lectureId = computed(() => this.#route.snapshot.queryParamMap.get('lectureId') ?? '');

  readonly canEdit = computed(() => {
    const user = this.#auth.currentUser();
    if (!user) return false;
    if (user.claims.is_platform_admin) return true;
    const cid = this.courseId();
    return cid ? user.claims.lecturer_can_edit_course_ids.includes(cid) : false;
  });

  readonly moduleFormData = signal<ModuleFormData>({
    title: '', description: null, module_type: 'video', lecture_id: '', estimated_duration_minutes: 15,
  });
  readonly videoFormData = signal<VideoFormData>({
    bunny_video_id: '', bunny_library_id: 0, original_filename: null,
  });
  readonly pdfFormData = signal<PdfFormData>({
    file_url: '', file_name: '', page_count: null,
  });
  readonly examFormData = signal<ExamFormData>({
    title: '', description: null, duration_minutes: 60,
    passing_score: 70, max_file_size: 52428800,
    allowed_file_types: ['application/pdf', 'application/zip'],
    exam_file_url: null,
  });
  readonly markdownFormData = signal<MarkdownFormData>({ content: '' });
  readonly quizFormData = signal<QuizFormData>({
    title: '', description: null, time_limit: null, passing_score: 70,
    max_attempts: null, show_correct_answers: true,
    randomize_questions: false, randomize_answers: false, questions: [],
  });
  readonly externalQuizFormData = signal<ExternalQuizFormData>({
    external_quiz_id: '', external_quiz_url: '', passing_score: null,
  });
  readonly audioFormData = signal<AudioFormData>({
    file_url: '', file_name: '', file_size: null, duration_seconds: null, mime_type: 'audio/mpeg',
  });
  readonly downloadFormData = signal<DownloadFormData>({
    file_url: '', file_name: '', file_size: null,
  });

  readonly availableTypes: TypeOption[] = [
    { value: 'video', label: 'Video', hint: 'Upload a video', icon: Video },
    { value: 'pdf', label: 'PDF', hint: 'Upload a PDF document', icon: FileText },
    { value: 'markdown', label: 'Rich Text', hint: 'Write with a rich text editor', icon: Type },
    { value: 'quiz', label: 'Quiz', hint: 'Interactive quiz', icon: HelpCircle },
    { value: 'exam', label: 'Exam', hint: 'Graded exam submission', icon: ClipboardCheck },
    { value: 'external_quiz', label: 'External Quiz', hint: 'Link to an external quiz', icon: ExternalLink },
    { value: 'audio', label: 'Audio', hint: 'Upload an audio file', icon: Headphones },
    { value: 'download', label: 'Downloadable Files', hint: 'ZIP archive for download', icon: FolderArchive },
  ];

  async ngOnInit() {
    if (!this.canEdit()) {
      this.#router.navigate(['/courses', this.courseId()]);
      return;
    }

    if (this.isEditMode()) {
      await this.#loadForEdit();
    } else {
      if (!this.lectureId()) {
        this.errorMessage.set('Missing lecture ID');
        return;
      }
      // Ensure courseDetail is loaded for sort_order calculation
      if (!this.#courseService.courseDetail() || this.#courseService.courseDetail()!.id !== this.courseId()) {
        await this.#courseService.loadCourseDetail(this.courseId());
      }
      this.moduleFormData.update(d => ({ ...d, lecture_id: this.lectureId() }));
    }
  }

  selectType(type: ModuleType) {
    this.selectedType.set(type);
    this.moduleFormData.update(d => ({ ...d, module_type: type }));
  }

  async onSave(payload: ModuleSavePayload) {
    this.saving.set(true);
    payload.module.estimated_duration_minutes = this.estimatedDuration();
    try {
      if (this.isEditMode()) {
        payload.significantUpdate = this.significantUpdate();
        await this.#courseService.updateModule(this.moduleId(), payload);
      } else {
        await this.#courseService.createModule(this.courseId(), payload);
      }
      this.#router.navigate(['/courses', this.courseId()]);
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to save module'));
    } finally {
      this.saving.set(false);
    }
  }

  onCancel() {
    this.#router.navigate(['/courses', this.courseId()]);
  }

  async #loadForEdit() {
    this.loading.set(true);
    try {
      const { module, content } = await this.#courseService.loadModuleForEdit(this.moduleId());
      this.selectedType.set(module.module_type);
      this.estimatedDuration.set(module.estimated_duration_minutes);
      this.moduleFormData.set({
        title: module.title,
        description: module.description,
        module_type: module.module_type,
        lecture_id: module.lecture_id,
        estimated_duration_minutes: module.estimated_duration_minutes,
      });
      if (content.type === 'video' && content.data) {
        this.videoFormData.set(content.data);
      }
      if (content.type === 'pdf' && content.data) {
        this.pdfFormData.set(content.data);
      }
      if (content.type === 'exam' && content.data) {
        this.examFormData.set(content.data);
      }
      if (content.type === 'markdown' && content.data) {
        this.markdownFormData.set(content.data);
      }
      if (content.type === 'quiz' && content.data) {
        this.quizFormData.set(content.data);
      }
      if (content.type === 'external_quiz' && content.data) {
        this.externalQuizFormData.set(content.data);
      }
      if (content.type === 'audio' && content.data) {
        this.audioFormData.set(content.data);
      }
      if (content.type === 'download' && content.data) {
        this.downloadFormData.set(content.data);
      }
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      this.loading.set(false);
    }
  }
}
