import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import {
  LucideAngularModule, ArrowLeft, Search, Layers, Calendar, Tag, TrendingUp, TrendingDown,
  Minus, Loader2, AlertTriangle, ChevronRight, Box, SearchX,
} from 'lucide-angular';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { XlngApiService } from '../services/xlng-api.service';
import { XlngVariationDetail, XlngScenarioBase } from '../models/xlng.model';

interface ScenarioWithProfit {
  scenario: XlngScenarioBase;
  profit: number | null;
  loading: boolean;
  error: boolean;
}

@Component({
  selector: 'app-xlng-variation-detail-page',
  standalone: true,
  imports: [RouterLink, SlicePipe, LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <a routerLink="/xlng" class="back-link mb-4">
        <lucide-icon [img]="icons.ArrowLeft" [size]="16" />
        Back to variations
      </a>

      @if (loading()) {
        <app-loading-spinner message="Loading variation..." />
      } @else if (error()) {
        <app-error-alert [message]="error()!" />
      } @else if (variation()) {
        <div class="mb-6">
          <h1 class="page-title">{{ variation()!.name }}</h1>
          @if (variation()!.description) {
            <p class="text-sm text-slate-500 mt-1">{{ variation()!.description }}</p>
          }

          <div class="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500">
            <span class="flex items-center gap-1.5">
              <lucide-icon [img]="icons.Layers" [size]="16" />
              {{ variation()!.amountScenarios }} scenarios
            </span>
            <span class="flex items-center gap-1.5">
              <lucide-icon [img]="icons.Calendar" [size]="16" />
              {{ variation()!.startDate | slice:0:10 }} to {{ variation()!.endDate | slice:0:10 }}
            </span>
          </div>

          @if (variation()!.simulatedProducts.length > 0) {
            <div class="flex flex-wrap gap-1.5 mt-3">
              @for (product of variation()!.simulatedProducts; track product) {
                <span class="badge-primary text-xs">
                  <lucide-icon [img]="icons.Box" [size]="10" class="mr-0.5" />
                  {{ product }}
                </span>
              }
            </div>
          }
        </div>

        <div class="mb-4">
          <div class="relative">
            <lucide-icon [img]="icons.Search" [size]="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              class="search-input"
              placeholder="Search scenarios..."
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
          </div>
        </div>

        <div class="flex items-center justify-between mb-3">
          <span class="text-sm text-slate-500">
            {{ filtered().length }} of {{ scenarios().length }} scenarios
          </span>
          <span class="text-sm text-slate-500">
            {{ profitsLoaded() }} / {{ scenarios().length }} profits loaded
          </span>
        </div>

        @if (filtered().length === 0) {
          <app-empty-state [icon]="icons.SearchX" message="No scenarios found. Try adjusting your search." />
        } @else {
          <div class="table-container">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="th text-left">Scenario</th>
                  <th class="th text-left">State</th>
                  <th class="th text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                @for (s of filtered(); track s.scenario.id) {
                  <tr class="table-row">
                    <td class="table-cell font-medium text-slate-800">
                      {{ s.scenario.name }}
                    </td>
                    <td class="table-cell">
                      <span [class]="stateClass(s.scenario.state)">
                        {{ s.scenario.state }}
                      </span>
                    </td>
                    <td class="table-cell text-right tabular-nums">
                      @if (s.loading) {
                        <span class="inline-flex animate-spin text-slate-400">
                          <lucide-icon [img]="icons.Loader2" [size]="16" />
                        </span>
                      } @else if (s.error) {
                        <span class="text-slate-400 flex items-center justify-end gap-1">
                          <lucide-icon [img]="icons.AlertTriangle" [size]="14" />
                          N/A
                        </span>
                      } @else if (s.profit !== null) {
                        <span
                          class="flex items-center justify-end gap-1 font-medium"
                          [class.text-emerald-600]="s.profit >= 0"
                          [class.text-rose-600]="s.profit < 0"
                        >
                          @if (s.profit > 0) {
                            <lucide-icon [img]="icons.TrendingUp" [size]="14" />
                          } @else if (s.profit < 0) {
                            <lucide-icon [img]="icons.TrendingDown" [size]="14" />
                          } @else {
                            <lucide-icon [img]="icons.Minus" [size]="14" />
                          }
                          {{ formatProfit(s.profit) }}
                        </span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
})
export class XlngVariationDetailPageComponent implements OnInit {
  #route = inject(ActivatedRoute);
  #api = inject(XlngApiService);

  readonly icons = {
    ArrowLeft, Search, Layers, Calendar, Tag, TrendingUp, TrendingDown,
    Minus, Loader2, AlertTriangle, ChevronRight, Box, SearchX,
  };

  loading = signal(true);
  error = signal<string | null>(null);
  variation = signal<XlngVariationDetail | null>(null);
  scenarios = signal<ScenarioWithProfit[]>([]);
  searchTerm = signal('');

  filtered = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const list = this.scenarios();
    if (!term) return list;
    return list.filter((s) => s.scenario.name.toLowerCase().includes(term));
  });

  profitsLoaded = computed(() =>
    this.scenarios().filter((s) => !s.loading).length,
  );

  ngOnInit(): void {
    const id = this.#route.snapshot.paramMap.get('variationId');
    if (id) this.#load(id);
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
    const BATCH_SIZE = 10;
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
          s.scenario.id === scenarioId
            ? { ...s, profit, loading: false }
            : s,
        ),
      );
    } catch {
      this.scenarios.update((list) =>
        list.map((s) =>
          s.scenario.id === scenarioId
            ? { ...s, loading: false, error: true }
            : s,
        ),
      );
    }
  }

  stateClass(state: string): string {
    switch (state) {
      case 'CalculationSuccess':
      case 'Calculated':
        return 'badge-success';
      case 'ReadyForCalculation':
      case 'CalculationRunning':
        return 'badge-warning';
      case 'Draft':
      case 'Archived':
        return 'badge-neutral';
      default:
        return 'badge-info';
    }
  }

  formatProfit(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  }
}
