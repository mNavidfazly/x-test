import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

function redirectToLogin(router: Router, url: string): false {
  router.navigate(['/login'], {
    queryParams: url !== '/' ? { returnUrl: url } : {},
  });
  return false;
}

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.loading()) {
    if (auth.isAuthenticated()) return true;
    return redirectToLogin(router, state.url);
  }

  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      if (auth.isAuthenticated()) return true;
      return redirectToLogin(router, state.url);
    }),
  );
};
