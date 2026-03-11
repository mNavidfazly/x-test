import { signal, computed } from '@angular/core';
import { vi } from 'vitest';
import { LEVELS, getLevelForXp, XpBreakdown, LevelDefinition } from '../core/services/xp.service';

export function createMockXpService(options?: {
  totalXp?: number;
  loading?: boolean;
}) {
  const xp = options?.totalXp ?? 0;
  const breakdown = signal<XpBreakdown>({
    total: xp,
    modules: 0,
    quizzes: 0,
    exams: 0,
    knowledgeChecks: 0,
    engagement: 0,
  });
  const loading = signal(options?.loading ?? false);
  const levelUp = signal<LevelDefinition | null>(null);

  const totalXp = computed(() => breakdown().total);
  const currentLevel = computed(() => getLevelForXp(totalXp()));
  const nextLevel = computed(() => {
    const current = currentLevel();
    return current.level < LEVELS.length ? LEVELS[current.level] : null;
  });
  const progressToNext = computed(() => {
    const current = currentLevel();
    const next = nextLevel();
    if (!next) return 100;
    const range = next.xpRequired - current.xpRequired;
    const progress = totalXp() - current.xpRequired;
    return Math.min(100, Math.round((progress / range) * 100));
  });

  return {
    breakdown: breakdown.asReadonly(),
    totalXp,
    currentLevel,
    nextLevel,
    progressToNext,
    loading: loading.asReadonly(),
    error: signal('').asReadonly(),
    levelUp: levelUp.asReadonly(),
    loadXp: vi.fn().mockResolvedValue(undefined),
    dismissLevelUp: vi.fn(),
    // Test helpers
    _setBreakdown: breakdown.set.bind(breakdown),
    _setLoading: loading.set.bind(loading),
    _setLevelUp: levelUp.set.bind(levelUp),
  };
}

export type MockXpService = ReturnType<typeof createMockXpService>;
