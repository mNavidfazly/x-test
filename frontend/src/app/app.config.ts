import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { PosthogService } from './core/services/posthog.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpErrorInterceptor])),
    provideMarkdown(),
    {
      provide: APP_INITIALIZER,
      useFactory: (posthog: PosthogService) => () => posthog.init(),
      deps: [PosthogService],
      multi: true,
    },
  ],
};
