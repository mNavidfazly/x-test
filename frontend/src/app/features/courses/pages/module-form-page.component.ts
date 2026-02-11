import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Loader2, Video, FileText, Type, HelpCircle, ClipboardCheck, LucideIconData } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { VideoFormComponent } from '../components/video-form.component';
import { PdfFormComponent } from '../components/pdf-form.component';
import { ExamFormComponent } from '../components/exam-form.component';
import { MarkdownFormComponent } from '../components/markdown-form.component';
import { ModuleFilesEditorComponent } from '../components/module-files-editor.component';
import { ModuleType, ModuleFormData, VideoFormData, PdfFormData, ExamFormData, MarkdownFormData, ModuleSavePayload, ModuleContentFormData } from '../../../core/models/course.model';

interface TypeOption {
  value: ModuleType;
  label: string;
  hint: string;
  icon: LucideIconData;
}

@Component({
  selector: 'app-module-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, FormsModule, VideoFormComponent, PdfFormComponent, ExamFormComponent, MarkdownFormComponent, ModuleFilesEditorComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-2xl">
      <a [routerLink]="['/courses', courseId()]" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
        Back to course
      </a>

      <h1 class="text-xl font-bold text-slate-900 mb-6">
        {{ isEditMode() ? 'Edit Module' : 'New Module' }}
      </h1>

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
          Loading...
        </div>
      } @else if (errorMessage()) {
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
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

        <!-- Video form -->
        @if (selectedType() === 'video') {
          <app-video-form
            [initialModuleData]="moduleFormData()"
            [initialVideoData]="videoFormData()"
            [isEditMode]="isEditMode()"
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

        <!-- Generic form for quiz type -->
        @if (selectedType() === 'quiz') {
          <div class="space-y-5">
            <div>
              <label for="genericTitle" class="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                id="genericTitle"
                type="text"
                [(ngModel)]="genericForm.title"
                placeholder="Module title"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
              />
            </div>

            <div>
              <label for="genericDescription" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                id="genericDescription"
                [(ngModel)]="genericForm.description"
                placeholder="Module description (optional)"
                rows="2"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200 resize-none"
              ></textarea>
            </div>

            <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Quiz Builder coming in Phase 3D.
            </div>

            <div class="flex items-center gap-3 pt-2">
              <button
                type="button"
                (click)="onSaveGeneric()"
                [disabled]="!genericForm.title.trim()"
                class="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isEditMode() ? 'Save Changes' : 'Create Module' }}
              </button>
              <button
                type="button"
                (click)="onCancel()"
                class="bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
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
  #route = inject(ActivatedRoute);
  #router = inject(Router);

  readonly icons = { ArrowLeft, Loader2 };

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly selectedType = signal<ModuleType | null>(null);

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
    title: '', description: null, module_type: 'video', lecture_id: '',
  });
  readonly videoFormData = signal<VideoFormData>({
    video_url: '', thumbnail_url: null, duration: null,
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

  genericForm = { title: '', description: null as string | null };

  readonly availableTypes: TypeOption[] = [
    { value: 'video', label: 'Video', hint: 'Link to an external video', icon: Video },
    { value: 'pdf', label: 'PDF', hint: 'Upload a PDF document', icon: FileText },
    { value: 'markdown', label: 'Rich Text', hint: 'Write with a rich text editor', icon: Type },
    { value: 'quiz', label: 'Quiz', hint: 'Interactive quiz', icon: HelpCircle },
    { value: 'exam', label: 'Exam', hint: 'Graded exam submission', icon: ClipboardCheck },
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
    this.errorMessage.set('');
    try {
      if (this.isEditMode()) {
        await this.#courseService.updateModule(this.moduleId(), payload);
      } else {
        await this.#courseService.createModule(this.courseId(), payload);
      }
      this.#router.navigate(['/courses', this.courseId()]);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to save module');
    } finally {
      this.saving.set(false);
    }
  }

  async onSaveGeneric() {
    if (!this.genericForm.title.trim()) return;
    const type = this.selectedType();
    if (!type) return;

    const payload: ModuleSavePayload = {
      module: {
        title: this.genericForm.title,
        description: this.genericForm.description,
        module_type: type,
        lecture_id: this.moduleFormData().lecture_id,
      },
      content: { type, data: null } as ModuleContentFormData,
    };
    await this.onSave(payload);
  }

  onCancel() {
    this.#router.navigate(['/courses', this.courseId()]);
  }

  async #loadForEdit() {
    this.loading.set(true);
    try {
      const { module, content } = await this.#courseService.loadModuleForEdit(this.moduleId());
      this.selectedType.set(module.module_type);
      this.moduleFormData.set({
        title: module.title,
        description: module.description,
        module_type: module.module_type,
        lecture_id: module.lecture_id,
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
      this.genericForm = { title: module.title, description: module.description };
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      this.loading.set(false);
    }
  }
}
