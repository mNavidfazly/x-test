import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, BookOpen, Clock, ArrowRight } from 'lucide-angular';
import { CourseWithProgress } from '../../../core/models/course.model';

const BADGE_STYLES: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  invite_only: 'bg-amber-100 text-amber-700',
  password_protected: 'bg-slate-100 text-slate-600',
};

const BADGE_LABELS: Record<string, string> = {
  open: 'Open',
  invite_only: 'Invite only',
  password_protected: 'Password',
};

@Component({
  selector: 'app-course-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <a [routerLink]="['/courses', course().id]"
       class="block bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden group">

      <!-- Thumbnail -->
      @if (course().thumbnail_url) {
        <div class="aspect-video bg-slate-100 overflow-hidden">
          <img [src]="course().thumbnail_url" [alt]="course().title"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      } @else {
        <div class="aspect-video bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
          <lucide-icon [img]="icons.BookOpen" [size]="48" class="text-white/50"></lucide-icon>
        </div>
      }

      <div class="p-4">
        <!-- Title + Badge -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-slate-900 line-clamp-2 flex-1">{{ course().title }}</h3>
          <span [class]="'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ' + badgeStyle()">
            {{ badgeLabel() }}
          </span>
        </div>

        <!-- Description -->
        @if (course().description) {
          <p class="text-xs text-slate-500 line-clamp-2 mb-3">{{ course().description }}</p>
        }

        <!-- Progress Bar -->
        @if (course().isEnrolled && course().moduleCount > 0) {
          <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-500">{{ course().completedModules }}/{{ course().moduleCount }} modules</span>
              <span class="text-xs font-semibold text-slate-700 tabular-nums">{{ course().progressPercent }}%</span>
            </div>
            <div class="bg-slate-200 rounded-full h-2">
              <div class="bg-teal-600 rounded-full h-2 transition-all duration-300"
                   [style.width.%]="course().progressPercent"></div>
            </div>
          </div>
        }

        <!-- Footer -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <span class="flex items-center gap-1">
              <lucide-icon [img]="icons.BookOpen" [size]="12"></lucide-icon>
              {{ course().moduleCount }} modules
            </span>
            @if (course().lastActivity) {
              <span class="flex items-center gap-1">
                <lucide-icon [img]="icons.Clock" [size]="12"></lucide-icon>
                {{ relativeDate() }}
              </span>
            }
          </div>
          <span [class]="'text-xs font-semibold flex items-center gap-1 ' + actionColor()">
            {{ actionLabel() }}
            <lucide-icon [img]="icons.ArrowRight" [size]="12"></lucide-icon>
          </span>
        </div>
      </div>
    </a>
  `,
})
export class CourseCardComponent {
  readonly course = input.required<CourseWithProgress>();
  readonly icons = { BookOpen, Clock, ArrowRight };

  readonly badgeStyle = computed(() => BADGE_STYLES[this.course().enrollment_type] ?? BADGE_STYLES['open']);
  readonly badgeLabel = computed(() => BADGE_LABELS[this.course().enrollment_type] ?? this.course().enrollment_type);

  readonly actionLabel = computed(() => {
    const c = this.course();
    if (!c.isEnrolled) return 'View';
    if (c.progressPercent === 100) return 'Review';
    if (c.completedModules > 0) return 'Continue';
    return 'Start';
  });

  readonly actionColor = computed(() => {
    const label = this.actionLabel();
    if (label === 'Review') return 'text-emerald-600';
    if (label === 'Continue') return 'text-teal-600';
    return 'text-slate-500';
  });

  readonly relativeDate = computed(() => {
    const last = this.course().lastActivity;
    if (!last) return '';

    const diff = Date.now() - new Date(last).getTime();
    if (isNaN(diff)) return '';
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  });
}
