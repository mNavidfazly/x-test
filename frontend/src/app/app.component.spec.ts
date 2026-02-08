import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  async function renderComponent() {
    return render(AppComponent, {
      providers: [provideRouter([])],
    });
  }

  it('should render without errors', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  it('should contain a router-outlet', async () => {
    const { container } = await renderComponent();
    expect(container.querySelector('router-outlet')).toBeTruthy();
  });
});
