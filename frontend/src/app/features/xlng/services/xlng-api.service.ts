import { Injectable, inject } from '@angular/core';
import { KeycloakService } from '../../../core/services/keycloak.service';
import { environment } from '../../../../environments/environment';
import { XlngPageResponse, XlngVariationBase, XlngVariationDetail } from '../models/xlng.model';

const SERVICE_URLS: Record<string, string> = {
  datacore: environment.xlngUrls.datacore,
  'operation-plan-manager': environment.xlngUrls.operationPlanManager,
};

@Injectable({ providedIn: 'root' })
export class XlngApiService {
  #keycloak = inject(KeycloakService);
  #retried = false;

  async #fetch<T>(service: string, path: string): Promise<T> {
    const token = this.#keycloak.getToken();
    if (!token) throw new Error('Not authenticated with xLNG');

    const res = await fetch(`${SERVICE_URLS[service]}/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 401 && !this.#retried) {
      this.#retried = true;
      await this.#keycloak.refreshToken();
      const result = await this.#fetch<T>(service, path);
      this.#retried = false;
      return result;
    }

    this.#retried = false;
    if (!res.ok) throw new Error(`xLNG API error: ${res.status}`);
    return res.json();
  }

  async getVariations(page = 0, size = 100): Promise<{ items: XlngVariationBase[]; total: number }> {
    const res = await this.#fetch<XlngPageResponse<XlngVariationBase>>(
      'datacore',
      `scenario-variations?page=${page}&size=${size}`,
    );
    return {
      items: res.content ?? res.items ?? [],
      total: res.totalElements ?? res.total ?? 0,
    };
  }

  getVariation(id: string): Promise<XlngVariationDetail> {
    return this.#fetch<XlngVariationDetail>('datacore', `scenario-variations/${id}`);
  }

  async getOperationPlanProfit(scenarioId: string): Promise<number> {
    const plan = await this.#fetch<{ profit: number }>(
      'operation-plan-manager',
      `operation-plans/${scenarioId}`,
    );
    return plan.profit;
  }
}
