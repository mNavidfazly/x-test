import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { LucideAngularModule, Search, Layers, Calendar, Tag, User, ChevronRight, SearchX } from 'lucide-angular';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { XlngApiService } from '../services/xlng-api.service';
import { XlngVariationBase } from '../models/xlng.model';

@Component({
  selector: 'app-xlng-variations-page',
  standalone: true,
  imports: [RouterLink, SlicePipe, LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="page-title">xLNG Scenarios</h1>
        <p class="text-sm text-slate-500 mt-1">Browse and compare portfolio scenario variations</p>
      </div>

      @if (loading()) {
        <app-loading-spinner message="Loading variations..." />
      } @else if (error()) {
        <app-error-alert [message]="error()!" />
      } @else {
        <div class="mb-4">
          <div class="relative">
            <lucide-icon [img]="icons.Search" [size]="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              class="search-input"
              placeholder="Search variations..."
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
          </div>
        </div>

        @if (filtered().length === 0) {
          <app-empty-state
            [icon]="icons.SearchX"
            message="No variations found. Try adjusting your search criteria."
          />
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            @for (v of filtered(); track v.id) {
              <a
                [routerLink]="['/xlng', v.id]"
                class="card group hover:shadow-md transition-shadow duration-200 cursor-pointer"
              >
                <div class="p-5">
                  <div class="flex items-start justify-between mb-2">
                    <h3 class="font-semibold text-slate-800 group-hover:text-teal-600 transition-colors line-clamp-1">
                      {{ v.name }}
                    </h3>
                    <span class="ml-2 shrink-0" [class]="stateClass(v.state)">
                      {{ v.state }}
                    </span>
                  </div>

                  @if (v.description) {
                    <p class="text-sm text-slate-500 line-clamp-2 mb-3">{{ v.description }}</p>
                  }

                  <div class="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span class="flex items-center gap-1">
                      <lucide-icon [img]="icons.Layers" [size]="14" />
                      {{ v.amountScenarios }} scenarios
                    </span>
                    <span class="flex items-center gap-1">
                      <lucide-icon [img]="icons.Calendar" [size]="14" />
                      {{ v.creationDate | slice:0:10 }}
                    </span>
                    @if (v.creationUser) {
                      <span class="flex items-center gap-1">
                        <lucide-icon [img]="icons.User" [size]="14" />
                        {{ v.creationUser }}
                      </span>
                    }
                  </div>

                  @if (v.tags.length > 0) {
                    <div class="flex flex-wrap gap-1.5 mb-3">
                      @for (tag of v.tags; track tag) {
                        <span class="badge-neutral text-xs">
                          <lucide-icon [img]="icons.Tag" [size]="10" class="mr-0.5" />
                          {{ tag }}
                        </span>
                      }
                    </div>
                  }

                  <div class="flex items-center justify-end text-teal-600 text-sm font-medium">
                    View details
                    <lucide-icon [img]="icons.ChevronRight" [size]="16" class="ml-1" />
                  </div>
                </div>
              </a>
            }
          </div>
        }
      }
    </div>
  `,
})
export class XlngVariationsPageComponent implements OnInit {
  #api = inject(XlngApiService);

  readonly icons = { Search, Layers, Calendar, Tag, User, ChevronRight, SearchX };

  loading = signal(true);
  error = signal<string | null>(null);
  variations = signal<XlngVariationBase[]>([]);
  searchTerm = signal('');

  filtered = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.variations();
    return this.variations().filter(
      (v) =>
        v.name.toLowerCase().includes(term) ||
        v.description?.toLowerCase().includes(term) ||
        v.tags.some((t) => t.toLowerCase().includes(term)),
    );
  });

  ngOnInit(): void {
    this.#load();
  }

  async #load(): Promise<void> {
    try {
      const { items } = await this.#api.getVariations();
      this.variations.set(items);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load variations');
    } finally {
      this.loading.set(false);
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
        return 'badge-neutral';
      case 'Archived':
        return 'badge-neutral';
      default:
        return 'badge-info';
    }
  }
}
