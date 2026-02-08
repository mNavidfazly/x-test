import { Component, Input } from '@angular/core';

@Component({
  selector: 'lucide-icon',
  standalone: true,
  template: '<span data-testid="lucide-icon"></span>',
})
export class MockLucideIconComponent {
  @Input() img: unknown;
  @Input() size: number = 24;
  @Input() color: string = '';
  @Input() strokeWidth: number = 2;
}
