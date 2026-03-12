import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, Star, Award, Trophy, Flame, Crown, BookOpen, Brain, FileCheck, Lightbulb, MessageCircle, Sparkles } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { XpService } from '../../core/services/xp.service';
import { XpAnimationService } from '../../core/services/xp-animation.service';

function iconForLevel(level: number) {
  if (level <= 3) return Star;
  if (level <= 5) return Award;
  if (level <= 7) return Trophy;
  if (level === 8) return Flame;
  return Crown;
}

@Component({
  selector: 'app-level-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe],
  host: {
    class: 'relative',
    '(document:click)': 'onClickOutside($event)',
  },
  template: `
    @if (isLearner()) {
      @if (xpService.loading() && xpService.totalXp() === 0) {
        <div class="w-16 h-7 rounded-full skeleton-bar"></div>
      } @else {
        <div class="flex items-center gap-2">
          <!-- Badge button -->
          <button
            id="xp-level-badge"
            type="button"
            [attr.aria-label]="'Level ' + xpService.currentLevel().level + ' - ' + xpService.currentLevel().name + ' - ' + xpService.totalXp() + ' XP'"
            class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-[background-color,transform] duration-200 hover:opacity-90"
            [class]="xpService.currentLevel().bgClass"
            [class.level-pop]="!!xpService.levelUp() || xpAnimation.badgePulse()"
            (click)="toggle($event)"
          >
            <lucide-icon [img]="levelIcon()" [size]="14"></lucide-icon>
            <span class="tabular-nums">Lv.{{ xpService.currentLevel().level }}</span>
          </button>

          <!-- Mini progress bar (desktop only) -->
          <div class="hidden sm:flex items-center gap-1.5">
            <div class="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-[width] duration-500"
                   [class]="xpService.currentLevel().progressBarClass"
                   [style.width.%]="xpService.progressToNext()">
              </div>
            </div>
            <span class="text-[10px] tabular-nums whitespace-nowrap"
                  [class]="xpService.currentLevel().textClass">
              {{ displayedXp() | number }} XP
            </span>
          </div>
        </div>

        <!-- Level-up celebration -->
        @if (xpService.levelUp(); as newLevel) {
          <div class="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 text-center"
               role="alert">
            <lucide-icon [img]="icons.Sparkles" [size]="24" class="text-amber-500 mx-auto mb-2"></lucide-icon>
            <p class="text-sm font-bold text-slate-800 mb-1">Level Up!</p>
            <p class="text-sm" [class]="newLevel.textClass">
              You're now a <span class="font-bold">{{ newLevel.name }}</span>
            </p>
            <button class="text-xs text-slate-400 mt-2 hover:text-slate-600" (click)="xpService.dismissLevelUp()">Dismiss</button>
          </div>
        }

        <!-- Popover -->
        @if (isOpen()) {
          <div class="fixed inset-0 z-40" (click)="close()"></div>
          <div class="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4" role="dialog" aria-label="XP Details">
            <!-- Header -->
            <div class="flex items-center gap-2 mb-3">
              <lucide-icon [img]="levelIcon()" [size]="20" [class]="xpService.currentLevel().textClass"></lucide-icon>
              <div>
                <p class="text-sm font-bold" [class]="xpService.currentLevel().textClass">{{ xpService.currentLevel().name }}</p>
                <p class="text-xs text-slate-500 tabular-nums">{{ xpService.totalXp() | number }} XP</p>
              </div>
            </div>

            <!-- Progress to next level -->
            @if (xpService.nextLevel(); as next) {
              <div class="mb-4">
                <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Lv.{{ xpService.currentLevel().level }}</span>
                  <span>Lv.{{ next.level }}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill rounded-full" [class]="xpService.currentLevel().progressBarClass" [style.width.%]="xpService.progressToNext()"></div>
                </div>
                <p class="text-[10px] text-slate-400 mt-1 tabular-nums">
                  {{ xpService.totalXp() }} / {{ next.xpRequired }} XP
                </p>
              </div>
            } @else {
              <p class="text-xs text-amber-600 font-medium mb-4">Max level reached</p>
            }

            <!-- Breakdown -->
            <div class="space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Breakdown</p>
              @for (cat of categories(); track cat.label) {
                <div class="flex items-center gap-2 text-xs">
                  <lucide-icon [img]="cat.icon" [size]="14" class="text-slate-400 shrink-0"></lucide-icon>
                  <span class="text-slate-600 flex-1">{{ cat.label }}</span>
                  <span class="tabular-nums font-medium text-slate-800">{{ cat.xp }}</span>
                </div>
              }
            </div>
          </div>
        }
      }
    }
  `,
})
export class LevelBadgeComponent {
  readonly xpService = inject(XpService);
  readonly xpAnimation = inject(XpAnimationService);
  #auth = inject(AuthService);
  #el = inject(ElementRef);

  readonly isOpen = signal(false);
  readonly displayedXp = signal(this.xpService.totalXp());

  readonly icons = { Star, Award, Trophy, Flame, Crown, BookOpen, Brain, FileCheck, Lightbulb, MessageCircle, Sparkles };

  constructor() {
    // Sync displayedXp with actual XP (for non-animated updates like initial load)
    effect(() => {
      const actual = this.xpService.totalXp();
      // Only sync directly when no animation target is active
      if (this.xpAnimation.xpCounterTarget() === null) {
        this.displayedXp.set(actual);
      }
    });

    // Animate counter when animation service sets a target
    effect(() => {
      const target = this.xpAnimation.xpCounterTarget();
      if (target !== null) {
        this.#animateCounter(this.displayedXp(), target);
      }
    });
  }

  readonly isLearner = computed(() => {
    const roles = this.#auth.roles();
    return roles.includes('learner') && !roles.some(r =>
      r === 'platform_admin' || r === 'tenant_admin' || r === 'csm' || r === 'lecturer'
    );
  });

  readonly levelIcon = computed(() => iconForLevel(this.xpService.currentLevel().level));

  readonly categories = computed(() => {
    const b = this.xpService.breakdown();
    return [
      { label: 'Modules', xp: b.modules, icon: BookOpen },
      { label: 'Quizzes', xp: b.quizzes, icon: Brain },
      { label: 'Exams', xp: b.exams, icon: FileCheck },
      { label: 'Knowledge Checks', xp: b.knowledgeChecks, icon: Lightbulb },
      { label: 'Engagement', xp: b.engagement, icon: MessageCircle },
    ];
  });

  toggle(event: Event) {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  close() {
    this.isOpen.set(false);
  }

  onClickOutside(event: Event) {
    if (this.isOpen() && !this.#el.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  #animateCounter(from: number, to: number) {
    const duration = 400;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      this.displayedXp.set(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }
}
