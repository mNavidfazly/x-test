import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { KeycloakService } from './keycloak.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly keycloak = inject(KeycloakService);
  private readonly baseUrl = environment.apiUrl;

  private getAuthHeaders(): Observable<HttpHeaders> {
    const token = this.keycloak.getToken();
    const headers = new HttpHeaders(
      token ? { Authorization: `Bearer ${token}` } : {},
    );
    return of(headers);
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

  delete<T>(path: string): Observable<T> {
    return this.getAuthHeaders().pipe(
      switchMap((headers) =>
        this.http.delete<T>(`${this.baseUrl}${path}`, { headers }),
      ),
    );
  }
}
