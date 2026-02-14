import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Returns true if the interceptor already showed a toast for this error.
 * Callers that also toast should check this to avoid double-toasting.
 */
export function isToastedByInterceptor(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse &&
    (err.status === 0 || err.status === 403 || err.status === 429 || err.status >= 500)
  );
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    retry({
      count: 1,
      delay: (error) => {
        // Only retry idempotent methods to avoid duplicate side-effects (e.g. sending emails twice)
        if (
          (req.method === 'GET' || req.method === 'HEAD') &&
          error instanceof HttpErrorResponse &&
          (error.status >= 500 || error.status === 0)
        )
          return timer(1000);
        return throwError(() => error);
      },
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) toast.error('Network error. Please check your connection.');
      else if (error.status === 403) toast.error('You do not have permission to perform this action.');
      else if (error.status === 429) toast.warning('Too many requests. Please wait a moment.');
      else if (error.status >= 500) toast.error('Server error. Please try again later.');
      // 401: don't toast — auth session expiry handler covers this
      // 404: don't toast — callers handle these contextually
      return throwError(() => error);
    }),
  );
};
