import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseService);
  private readonly baseUrl = environment.apiUrl;

  private getAuthHeaders(): Observable<HttpHeaders> {
    return from(this.supabase.client.auth.getSession()).pipe(
      switchMap(({ data }) => {
        const token = data.session?.access_token;
        const headers = new HttpHeaders(
          token ? { Authorization: `Bearer ${token}` } : {},
        );
        return [headers];
      }),
    );
  }

  get<T>(path: string): Observable<T> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.get<T>(`${this.baseUrl}${path}`, { headers }),
      ),
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.post<T>(`${this.baseUrl}${path}`, body, { headers }),
      ),
    );
  }
}
