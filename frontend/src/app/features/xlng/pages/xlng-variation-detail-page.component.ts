import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideAngularModule, ArrowLeft, Search, Layers, Calendar, Check,
  ArrowRight, Loader2, AlertTriangle, Box, SearchX,
} from 'lucide-angular';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { XlngApiService } from '../services/xlng-api.service';
import { XlngVariationDetail, XlngScenarioBase } from '../models/xlng.model';
import { XlngComparisonDashboardComponent } from '../components/xlng-comparison-dashboard.component';

interface ScenarioWithProfit {
  scenario: XlngScenarioBase;
  profit: number | null;
  loading: boolean;
  error: boolean;
}

@Component({
  selector: 'app-xlng-variation-detail-page',
  standalone: true,
  imports: [
    RouterLink, LucideAngularModule,
    LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent,
    XlngComparisonDashboardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (showComparison() && selectedIds().size >= 2) {
      <app-xlng-comparison-dashboard
        [variationName]="variation()?.name ?? 'Variation'"
        [scenarios]="selectedScenarios()"
        (back)="showComparison.set(false)"
      />
    } @else {
      <div class="p-6 pb-24 max-w-7xl mx-auto">
        @if (loading()) {
          <app-loading-spinner message="Loading variation..." />
        } @else if (error()) {
          <app-error-alert [message]="error()!" />
        } @else if (variation()) {
          <div class="mb-6">
            <a routerLink="/xlng" class="back-link mb-3 inline-flex">
              <lucide-icon [img]="icons.ArrowLeft" [size]="14" />
              Back to Variations
            </a>
            <h1 class="page-title">{{ variation()!.name }}</h1>
            <p class="text-sm text-slate-500 mt-1">
              {{ scenarios().length }} scenarios — select scenarios to compare
            </p>

            @if ((variation()!.simulatedProducts ?? []).length > 0) {
              <div class="flex flex-wrap gap-1.5 mt-2">
                @for (product of variation()!.simulatedProducts; track product) {
                  <span class="badge-neutral text-xs">{{ product }}</span>
                }
              </div>
            }
          </div>

          <div class="flex items-center gap-3 mb-4">
            <div class="relative flex-1 max-w-sm">
              <lucide-icon [img]="icons.Search" [size]="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                class="search-input"
                placeholder="Search scenarios..."
                [value]="searchTerm()"
                (input)="searchTerm.set($any($event.target).value)"
              />
            </div>
            <button (click)="toggleSelectAll()" class="btn-secondary btn-sm">
              {{ selectedIds().size === scenarios().length ? 'Deselect All' : 'Select All' }}
            </button>
          </div>

          @if (filtered().length === 0) {
            <app-empty-state [icon]="icons.SearchX" message="No scenarios found. Try adjusting your search." />
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              @for (s of filtered(); track s.scenario.id) {
                <button
                  (click)="toggleSelect(s.scenario.id)"
                  class="border rounded-xl p-3 text-left transition-[border-color,background-color] duration-200 flex items-center gap-3"
                  [class.border-teal-500]="selectedIds().has(s.scenario.id)"
                  [class.bg-teal-50]="selectedIds().has(s.scenario.id)"
                  [class.border-slate-200]="!selectedIds().has(s.scenario.id)"
                  [class.bg-white]="!selectedIds().has(s.scenario.id)"
                  [class.hover:border-slate-300]="!selectedIds().has(s.scenario.id)"
                >
                  <div
                    class="w-5 h-5 rounded border flex items-center justify-center shrink-0"
                    [class.bg-teal-600]="selectedIds().has(s.scenario.id)"
                    [class.border-teal-600]="selectedIds().has(s.scenario.id)"
                    [class.border-slate-300]="!selectedIds().has(s.scenario.id)"
                  >
                    @if (selectedIds().has(s.scenario.id)) {
                      <lucide-icon [img]="icons.Check" [size]="12" class="text-white" />
                    }
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ s.scenario.name }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      @if (s.scenario.state) {
                        <span class="text-xs" [class]="stateTextClass(s.scenario.state)">
                          {{ s.scenario.state }}
                        </span>
                      }
                      @if (s.loading) {
                        <span class="inline-flex animate-spin text-slate-400">
                          <lucide-icon [img]="icons.Loader2" [size]="12" />
                        </span>
                      } @else if (s.profit !== null) {
                        <span
                          class="text-xs font-mono tabular-nums"
                          [class.text-emerald-600]="s.profit >= 0"
                          [class.text-rose-600]="s.profit < 0"
                        >
                          {{ formatMoney(s.profit) }}
                        </span>
                      } @else if (s.error) {
                        <span class="text-xs text-slate-400">N/A</span>
                      }
                    </div>
                  </div>
                </button>
              }
            </div>
          }

          @if (selectedIds().size >= 2) {
            <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-3 z-50 flex items-center justify-between">
              <p class="text-sm text-slate-600">{{ selectedIds().size }} scenarios selected</p>
              <button (click)="showComparison.set(true)" class="btn-primary flex items-center gap-2">
                Compare
                <lucide-icon [img]="icons.ArrowRight" [size]="14" />
              </button>
            </div>
          }
          @if (selectedIds().size === 1) {
            <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-3 z-50">
              <p class="text-sm text-slate-500">Select at least 2 scenarios to compare.</p>
            </div>
          }
        }
      </div>
    }
  `,
})
export class XlngVariationDetailPageComponent implements OnInit {
  #route = inject(ActivatedRoute);
  #api = inject(XlngApiService);

  readonly icons = {
    ArrowLeft, Search, Layers, Calendar, Check,
    ArrowRight, Loader2, AlertTriangle, Box, SearchX,
  };

  loading = signal(true);
  error = signal<string | null>(null);
  variation = signal<XlngVariationDetail | null>(null);
  scenarios = signal<ScenarioWithProfit[]>([]);
  searchTerm = signal('');
  selectedIds = signal<Set<string>>(new Set());
  showComparison = signal(false);

  filtered = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const list = this.scenarios();
    if (!term) return list;
    return list.filter((s) => s.scenario.name.toLowerCase().includes(term));
  });

  selectedScenarios = computed(() => {
    const ids = this.selectedIds();
    return this.scenarios().filter((s) => ids.has(s.scenario.id));
  });

  ngOnInit(): void {
    const id = this.#route.snapshot.paramMap.get('variationId');
    if (id) this.#load(id);
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    const all = this.scenarios();
    if (this.selectedIds().size === all.length) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(all.map((s) => s.scenario.id)));
    }
  }

  async #load(id: string): Promise<void> {
    try {
      const detail = await this.#api.getVariation(id);
      this.variation.set(detail);

      const childScenarios = this.#extractScenarios(detail);
      const items: ScenarioWithProfit[] = childScenarios.map((s) => ({
        scenario: s,
        profit: null,
        loading: true,
        error: false,
      }));
      this.scenarios.set(items);
      this.loading.set(false);

      this.#fetchProfits(childScenarios);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load variation');
      this.loading.set(false);
    }
  }

  #extractScenarios(detail: XlngVariationDetail): XlngScenarioBase[] {
    if (detail.scenarios && detail.scenarios.length > 0) {
      return detail.scenarios.map((s: any) => s.scenarioDetails ?? s);
    }
    if (detail.scenarioIds) {
      return detail.scenarioIds.map((id) => ({
        id,
        name: id,
        description: '',
        state: 'Unknown',
        timeWindowStart: '',
        timeWindowEnd: '',
        tags: [],
        creationDate: '',
        creationUser: '',
      }));
    }
    return [];
  }

  async #fetchProfits(childScenarios: XlngScenarioBase[]): Promise<void> {
    const BATCH_SIZE = 25;
    for (let i = 0; i < childScenarios.length; i += BATCH_SIZE) {
      const batch = childScenarios.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((s) => this.#fetchSingleProfit(s.id)),
      );
      if (i + BATCH_SIZE < childScenarios.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  async #fetchSingleProfit(scenarioId: string): Promise<void> {
    try {
      const profit = await this.#api.getOperationPlanProfit(scenarioId);
      this.scenarios.update((list) =>
        list.map((s) =>
          s.scenario.id === scenarioId ? { ...s, profit, loading: false } : s,
        ),
      );
    } catch {
      this.scenarios.update((list) =>
        list.map((s) =>
          s.scenario.id === scenarioId ? { ...s, loading: false, error: true } : s,
        ),
      );
    }
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
}
