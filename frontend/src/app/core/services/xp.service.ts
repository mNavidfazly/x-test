import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

// ── Level Definitions ──────────────────────────────────────────────

export interface LevelDefinition {
  level: number;
  name: string;
  xpRequired: number;
  bgClass: string;
  textClass: string;
  progressBarClass: string;
}

export const LEVELS: LevelDefinition[] = [
  { level: 1, name: 'Newcomer', xpRequired: 0, bgClass: 'bg-slate-100 text-slate-700', textClass: 'text-slate-700', progressBarClass: 'bg-slate-400' },
  { level: 2, name: 'Explorer', xpRequired: 50, bgClass: 'bg-blue-100 text-blue-700', textClass: 'text-blue-700', progressBarClass: 'bg-blue-500' },
  { level: 3, name: 'Learner', xpRequired: 150, bgClass: 'bg-cyan-100 text-cyan-700', textClass: 'text-cyan-700', progressBarClass: 'bg-cyan-500' },
  { level: 4, name: 'Student', xpRequired: 350, bgClass: 'bg-teal-100 text-teal-700', textClass: 'text-teal-700', progressBarClass: 'bg-teal-500' },
  { level: 5, name: 'Scholar', xpRequired: 650, bgClass: 'bg-emerald-100 text-emerald-700', textClass: 'text-emerald-700', progressBarClass: 'bg-emerald-500' },
  { level: 6, name: 'Specialist', xpRequired: 1100, bgClass: 'bg-amber-100 text-amber-700', textClass: 'text-amber-700', progressBarClass: 'bg-amber-500' },
  { level: 7, name: 'Expert', xpRequired: 1700, bgClass: 'bg-orange-100 text-orange-700', textClass: 'text-orange-700', progressBarClass: 'bg-orange-500' },
  { level: 8, name: 'Master', xpRequired: 2500, bgClass: 'bg-rose-100 text-rose-700', textClass: 'text-rose-700', progressBarClass: 'bg-rose-500' },
  { level: 9, name: 'Champion', xpRequired: 3500, bgClass: 'bg-purple-100 text-purple-700', textClass: 'text-purple-700', progressBarClass: 'bg-purple-500' },
  { level: 10, name: 'Legend', xpRequired: 5000, bgClass: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white', textClass: 'text-amber-600', progressBarClass: 'bg-gradient-to-r from-amber-400 to-yellow-500' },
];

export function getLevelForXp(xp: number): LevelDefinition {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) return LEVELS[i];
  }
  return LEVELS[0];
}

// ── XP Breakdown ───────────────────────────────────────────────────

export interface XpBreakdown {
  total: number;
  modules: number;
  quizzes: number;
  exams: number;
  knowledgeChecks: number;
  engagement: number;
}

export interface XpRawData {
  completedModules: number;
  passedQuizAttempts: { quiz_id: string; score: number; created_at: string }[];
  quizQuestionCounts: Record<string, number>;
  gradedExams: { score: number }[];
  externalQuizPasses: number;
  correctKnowledgeChecks: number;
  comments: number;
  replies: number;
  expertQuestions: number;
  enrollments: number;
}

/**
 * Compute quiz XP for a single attempt.
 * Formula: questionCount × multiplier + score/10 bonus
 * First pass multiplier = 2, retake multiplier = 1
 * Fallback to 10 questions if count unknown.
 */
export function computeQuizAttemptXp(questionCount: number, score: number, isFirstPass: boolean): number {
  const multiplier = isFirstPass ? 2 : 1;
  return questionCount * multiplier + Math.round(score / 10);
}

export function computeXp(data: XpRawData): XpBreakdown {
  // Modules: 10 XP each
  const modules = data.completedModules * 10;

  // Quizzes: questionCount × 2 (first pass) or × 1 (retake) + score/10 bonus
  let quizzes = 0;
  const firstPassPerQuiz = new Set<string>();
  const sorted = [...data.passedQuizAttempts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const attempt of sorted) {
    const isFirstPass = !firstPassPerQuiz.has(attempt.quiz_id);
    if (isFirstPass) firstPassPerQuiz.add(attempt.quiz_id);
    const questionCount = data.quizQuestionCounts[attempt.quiz_id] ?? 10;
    quizzes += computeQuizAttemptXp(questionCount, attempt.score, isFirstPass);
  }

  // Exams: 50 base + score/5 bonus
  let exams = 0;
  for (const sub of data.gradedExams) {
    exams += 50 + Math.round(sub.score / 5);
  }

  // External quizzes: 20 each
  exams += data.externalQuizPasses * 20;

  // Knowledge checks: 5 each
  const knowledgeChecks = data.correctKnowledgeChecks * 5;

  // Engagement: comments(3) + replies(2) + questions(5) + enrollments(5)
  const engagement =
    data.comments * 3 +
    data.replies * 2 +
    data.expertQuestions * 5 +
    data.enrollments * 5;

  return {
    total: modules + quizzes + exams + knowledgeChecks + engagement,
    modules,
    quizzes,
    exams,
    knowledgeChecks,
    engagement,
  };
}

// ── Service ────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class XpService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #breakdown = signal<XpBreakdown>({ total: 0, modules: 0, quizzes: 0, exams: 0, knowledgeChecks: 0, engagement: 0 });
  #loading = signal(false);
  #error = signal('');
  #lastLoadedAt: number | null = null;
  #previousLevel: LevelDefinition | null = null;
  #hasLoadedOnce = false;

  #levelUp = signal<LevelDefinition | null>(null);

  readonly breakdown = this.#breakdown.asReadonly();
  readonly totalXp = computed(() => this.#breakdown().total);
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();
  readonly levelUp = this.#levelUp.asReadonly();

  readonly currentLevel = computed(() => getLevelForXp(this.totalXp()));

  readonly nextLevel = computed(() => {
    const current = this.currentLevel();
    return current.level < LEVELS.length ? LEVELS[current.level] : null;
  });

  readonly progressToNext = computed(() => {
    const current = this.currentLevel();
    const next = this.nextLevel();
    if (!next) return 100;
    const range = next.xpRequired - current.xpRequired;
    const progress = this.totalXp() - current.xpRequired;
    return Math.min(100, Math.round((progress / range) * 100));
  });

  constructor() {
    effect(() => {
      const user = this.#auth.currentUser();
      if (user) {
        this.loadXp();
      } else {
        this.#breakdown.set({ total: 0, modules: 0, quizzes: 0, exams: 0, knowledgeChecks: 0, engagement: 0 });
        this.#lastLoadedAt = null;
        this.#previousLevel = null;
        this.#hasLoadedOnce = false;
      }
    });
  }

  async loadXp(force = false) {
    if (!force && this.#lastLoadedAt && Date.now() - this.#lastLoadedAt < 5 * 60 * 1000) {
      return;
    }

    const userId = this.#auth.currentUser()?.id;
    if (!userId) return;

    this.#previousLevel = this.currentLevel();
    this.#loading.set(true);
    this.#error.set('');

    try {
      const client = this.#supabase.client;

      // Single RPC replaces 10 parallel queries + client-side first/retake detection.
      // Server-side window function computes first-pass-vs-retake split per quiz_id,
      // returning the 5 pre-computed XP category totals. See migration 00055.
      const { data, error } = await client.rpc('get_user_xp_breakdown', { p_user_id: userId });
      if (error) throw error;

      const row = data?.[0] ?? {
        modules_xp: 0,
        quizzes_xp: 0,
        exams_xp: 0,
        knowledge_checks_xp: 0,
        engagement_xp: 0,
      };

      const breakdown: XpBreakdown = {
        total: row.modules_xp + row.quizzes_xp + row.exams_xp + row.knowledge_checks_xp + row.engagement_xp,
        modules: row.modules_xp,
        quizzes: row.quizzes_xp,
        exams: row.exams_xp,
        knowledgeChecks: row.knowledge_checks_xp,
        engagement: row.engagement_xp,
      };
      this.#breakdown.set(breakdown);
      this.#lastLoadedAt = Date.now();

      // Check for level-up (only after first load to avoid false positive on page refresh)
      const newLevel = getLevelForXp(breakdown.total);
      if (this.#hasLoadedOnce && this.#previousLevel && newLevel.level > this.#previousLevel.level) {
        this.#levelUp.set(newLevel);
        setTimeout(() => this.#levelUp.set(null), 4000);
      }
      this.#hasLoadedOnce = true;
    } catch {
      this.#error.set('Failed to load XP data');
    } finally {
      this.#loading.set(false);
    }
  }

  dismissLevelUp() {
    this.#levelUp.set(null);
  }
}
