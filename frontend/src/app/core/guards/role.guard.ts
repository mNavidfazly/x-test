import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.loading()) {
      if (auth.hasAnyRole(allowedRoles)) return true;
      router.navigate(['/']);
      return false;
    }

    return toObservable(auth.loading).pipe(
      filter((loading) => !loading),
      take(1),
      map(() => {
        if (auth.hasAnyRole(allowedRoles)) return true;
        router.navigate(['/']);
        return false;
      }),
    );
  };
}
