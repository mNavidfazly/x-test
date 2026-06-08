import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import {
  LucideAngularModule, ArrowLeft, TrendingUp, TrendingDown,
  Minus, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-angular';

interface ScenarioWithProfit {
  scenario: { id: string; name: string; state: string };
  profit: number | null;
  loading: boolean;
  error: boolean;
}

@Component({
  selector: 'app-xlng-comparison-dashboard',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col h-full">
      <!-- Top bar -->
      <div class="shrink-0 border-b border-slate-200 bg-white px-6 py-3 relative flex items-center">
        <button (click)="back.emit()" class="text-slate-500 hover:text-slate-800 transition-colors z-10">
          <lucide-icon [img]="icons.ArrowLeft" [size]="18" />
        </button>
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="text-center">
            <h1 class="text-base font-semibold text-slate-800">{{ variationName() }}</h1>
            <p class="text-[10px] text-slate-400">{{ scenarios().length }} scenarios compared</p>
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full space-y-5">

        <!-- Verdict Banner -->
        <div
          class="rounded-xl px-5 py-4 border"
          [class.border-emerald-200]="lossPct() === 0"
          [class.bg-emerald-50]="lossPct() === 0"
          [class.border-amber-200]="lossPct() > 0 && lossPct() <= 20"
          [class.bg-amber-50]="lossPct() > 0 && lossPct() <= 20"
          [class.border-rose-200]="lossPct() > 20"
          [class.bg-rose-50]="lossPct() > 20"
        >
          <p class="text-base font-semibold text-slate-800 leading-relaxed">
            @if (lossPct() === 0) {
              All {{ sorted().length }} scenarios are profitable.
              Best case <span class="text-emerald-600 font-mono">{{ formatMoney(sorted()[0]?.profit ?? 0) }}</span>,
              worst <span class="font-mono text-slate-600">{{ formatMoney(sorted()[sorted().length - 1].profit ?? 0) }}</span>.
            } @else if (lossPct() === 100) {
              All {{ sorted().length }} scenarios are loss-making.
              Best case <span class="text-rose-600 font-mono">{{ formatMoney(sorted()[0]?.profit ?? 0) }}</span>,
              worst <span class="font-mono text-rose-700">{{ formatMoney(sorted()[sorted().length - 1]?.profit ?? 0) }}</span>.
            } @else {
              <span [class.text-rose-600]="lossPct() > 50" [class.text-amber-600]="lossPct() <= 50">{{ lossPct() }}%</span>
              of scenarios lose money.
              Median profit <span class="font-mono text-slate-800">{{ formatMoney(stats().median) }}</span>,
              downside risk (P5) <span class="font-mono text-rose-600">{{ formatMoney(stats().p5) }}</span>.
            }
          </p>
        </div>

        <!-- P&L Statistics -->
        <div
          class="rounded-2xl border p-4"
          [class.border-emerald-200]="stats().mean >= 0"
          [class.bg-emerald-50]="stats().mean >= 0"
          [class.border-rose-200]="stats().mean < 0"
          [class.bg-rose-50]="stats().mean < 0"
        >
          <h3
            class="text-[10px] uppercase tracking-widest font-semibold mb-3"
            [class.text-emerald-600]="stats().mean >= 0"
            [class.text-rose-600]="stats().mean < 0"
          >
            Profit & Loss
          </h3>
          <div class="grid grid-cols-4 lg:grid-cols-8 gap-2">
            @for (card of pnlCards(); track card.label) {
              <div class="px-2 py-1.5">
                <p class="text-[9px] text-slate-500 uppercase tracking-widest">{{ card.label }}</p>
                <p
                  class="text-sm font-bold font-mono mt-0.5 tabular-nums"
                  [class.text-emerald-600]="card.positive"
                  [class.text-rose-600]="!card.positive"
                >
                  {{ card.value }}
                </p>
              </div>
            }
          </div>
        </div>

        <!-- Risk & Revenue -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <h3 class="text-[10px] text-rose-600 uppercase tracking-widest font-semibold mb-3">Risk Metrics</h3>
            <div class="grid grid-cols-4 gap-2">
              @for (card of riskCards(); track card.label) {
                <div class="px-2 py-1.5">
                  <p class="text-[9px] text-slate-500 uppercase tracking-widest">{{ card.label }}</p>
                  <p
                    class="text-sm font-bold font-mono mt-0.5 tabular-nums"
                    [class.text-emerald-600]="card.positive"
                    [class.text-rose-600]="!card.positive"
                  >
                    {{ card.value }}
                  </p>
                </div>
              }
            </div>
          </div>
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 class="text-[10px] text-emerald-600 uppercase tracking-widest font-semibold mb-3">Summary</h3>
            <div class="grid grid-cols-4 gap-2">
              @for (card of summaryCards(); track card.label) {
                <div class="px-2 py-1.5">
                  <p class="text-[9px] text-slate-500 uppercase tracking-widest">{{ card.label }}</p>
                  <p class="text-sm font-bold font-mono mt-0.5 tabular-nums text-slate-800">{{ card.value }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Profit Distribution Bar -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 class="text-sm font-bold text-slate-800 mb-4">Profit Distribution</h3>
          <div class="flex items-end gap-1 h-32">
            @for (bar of profitBars(); track bar.label) {
              <div class="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  class="w-full rounded-t transition-[height] duration-300"
                  [class.bg-emerald-500]="bar.mid >= 0"
                  [class.bg-rose-500]="bar.mid < 0"
                  [style.height.%]="bar.heightPct"
                  [title]="bar.label + ': ' + bar.count + ' scenarios'"
                ></div>
              </div>
            }
          </div>
          <div class="flex justify-between mt-1 text-[9px] text-slate-400 font-mono">
            <span>{{ formatMoney(stats().min) }}</span>
            <span>{{ formatMoney(stats().max) }}</span>
          </div>
        </div>

        <!-- Scenario Ranking Table -->
        <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-800">Scenario Ranking</h3>
            <span class="text-xs text-slate-400">sorted by profit</span>
          </div>
          <div class="table-container !border-0 !rounded-none !shadow-none">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="th text-left w-10">#</th>
                  <th class="th text-left">Scenario</th>
                  <th class="th text-left">State</th>
                  <th class="th text-right">Profit</th>
                  <th class="th text-right w-20">vs Mean</th>
                </tr>
              </thead>
              <tbody>
                @for (s of sorted(); track s.scenario.id; let i = $index) {
                  <tr class="table-row">
                    <td class="table-cell text-slate-400 text-xs">{{ i + 1 }}</td>
                    <td class="table-cell font-medium text-slate-800 truncate max-w-[200px]">{{ s.scenario.name }}</td>
                    <td class="table-cell">
                      <span class="text-xs" [class]="stateTextClass(s.scenario.state)">
                        {{ s.scenario.state }}
                      </span>
                    </td>
                    <td class="table-cell text-right font-mono tabular-nums">
                      @if (s.profit !== null) {
                        <span
                          class="font-medium"
                          [class.text-emerald-600]="s.profit >= 0"
                          [class.text-rose-600]="s.profit < 0"
                        >
                          <lucide-icon
                            [img]="s.profit > 0 ? icons.TrendingUp : s.profit < 0 ? icons.TrendingDown : icons.Minus"
                            [size]="12"
                            class="inline mr-1"
                          />
                          {{ formatMoney(s.profit) }}
                        </span>
                      } @else {
                        <span class="text-slate-400">—</span>
                      }
                    </td>
                    <td class="table-cell text-right text-xs font-mono tabular-nums">
                      @if (s.profit !== null) {
                        <span
                          [class.text-emerald-600]="(s.profit - stats().mean) >= 0"
                          [class.text-rose-600]="(s.profit - stats().mean) < 0"
                        >
                          {{ formatDelta(s.profit - stats().mean) }}
                        </span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class XlngComparisonDashboardComponent {
  variationName = input.required<string>();
  scenarios = input.required<ScenarioWithProfit[]>();
  back = output<void>();

  readonly icons = { ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp };

  sorted = computed(() => {
    const list = this.scenarios().filter((s) => s.profit !== null);
    return [...list].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  });

  stats = computed(() => {
    const profits = this.sorted().map((s) => s.profit!);
    if (profits.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, spread: 0, p5: 0, p10: 0, p90: 0, p95: 0 };
    }
    const sorted = [...profits].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const pct = (p: number) => sorted[Math.max(0, Math.ceil(n * p) - 1)];
    return {
      mean, median, stdDev,
      min: sorted[0],
      max: sorted[n - 1],
      spread: sorted[n - 1] - sorted[0],
      p5: pct(0.05),
      p10: pct(0.10),
      p90: pct(0.90),
      p95: pct(0.95),
    };
  });

  lossPct = computed(() => {
    const s = this.sorted();
    if (s.length === 0) return 0;
    const losers = s.filter((x) => (x.profit ?? 0) < 0).length;
    return Math.round((losers / s.length) * 100);
  });

  pnlCards = computed(() => {
    const s = this.stats();
    return [
      { label: 'Mean', value: this.formatMoney(s.mean), positive: s.mean >= 0 },
      { label: 'Median', value: this.formatMoney(s.median), positive: s.median >= 0 },
      { label: 'Std Dev', value: this.formatMoney(s.stdDev), positive: true },
      { label: 'Best', value: this.formatMoney(s.max), positive: s.max >= 0 },
      { label: 'Worst', value: this.formatMoney(s.min), positive: s.min >= 0 },
      { label: 'Spread', value: this.formatMoney(s.spread), positive: true },
      { label: 'P10', value: this.formatMoney(s.p10), positive: s.p10 >= 0 },
      { label: 'P90', value: this.formatMoney(s.p90), positive: s.p90 >= 0 },
    ];
  });

  riskCards = computed(() => {
    const s = this.stats();
    const profits = this.sorted().map((x) => x.profit!);
    const cvar5 = this.#cvar(profits, 0.05);
    return [
      { label: 'VaR (5%)', value: this.formatMoney(s.p5), positive: s.p5 >= 0 },
      { label: 'CVaR (5%)', value: this.formatMoney(cvar5), positive: cvar5 >= 0 },
      { label: 'P5', value: this.formatMoney(s.p5), positive: s.p5 >= 0 },
      { label: 'P95', value: this.formatMoney(s.p95), positive: s.p95 >= 0 },
    ];
  });

  summaryCards = computed(() => {
    const s = this.sorted();
    const total = s.length;
    const profitable = s.filter((x) => (x.profit ?? 0) >= 0).length;
    return [
      { label: 'Scenarios', value: `${total}` },
      { label: 'Profitable', value: `${profitable}` },
      { label: 'Loss-making', value: `${total - profitable}` },
      { label: 'Win Rate', value: total > 0 ? `${Math.round((profitable / total) * 100)}%` : '—' },
    ];
  });

  profitBars = computed(() => {
    const profits = this.sorted().map((s) => s.profit!);
    if (profits.length === 0) return [];
    const sorted = [...profits].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (min === max) return [{ label: this.formatMoney(min), count: profits.length, mid: min, heightPct: 100 }];
    const binCount = Math.min(20, Math.max(8, Math.ceil(Math.sqrt(profits.length) * 1.5)));
    const binWidth = (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      return { label: this.formatMoney((lo + hi) / 2), count: 0, mid: (lo + hi) / 2, heightPct: 0 };
    });
    for (const v of profits) {
      const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
      bins[idx].count++;
    }
    const maxCount = Math.max(...bins.map((b) => b.count));
    for (const b of bins) {
      b.heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
    }
    return bins;
  });

  #cvar(sorted: number[], p: number): number {
    const s = [...sorted].sort((a, b) => a - b);
    const cutoff = Math.max(1, Math.ceil(s.length * p));
    const tail = s.slice(0, cutoff);
    return tail.length > 0 ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
  }

  stateTextClass(state: string): string {
    if (state.includes('Success') || state === 'Calculated') return 'text-emerald-600';
    return 'text-slate-500';
  }

  formatMoney(val: number): string {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  formatDelta(val: number): string {
    const prefix = val >= 0 ? '+' : '';
    return `${prefix}${this.formatMoney(val)}`;
  }
}
