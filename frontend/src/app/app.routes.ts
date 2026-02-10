import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'request-access',
    loadComponent: () =>
      import('./features/auth/access-request/access-request.component').then(
        (m) => m.AccessRequestComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'courses',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/courses/pages/course-list-page.component').then(
                (m) => m.CourseListPageComponent,
              ),
          },
          {
            path: ':courseId',
            loadComponent: () =>
              import('./features/courses/pages/course-detail-page.component').then(
                (m) => m.CourseDetailPageComponent,
              ),
          },
        ],
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
      {
        path: 'teaching/:path',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
      {
        path: 'admin/:path',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
      {
        path: 'csm/:path',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
      {
        path: 'analytics/:path',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
      {
        path: 'platform/:path',
        loadComponent: () =>
          import('./shared/components/stub-page.component').then(
            (m) => m.StubPageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
