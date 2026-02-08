import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule, GraduationCap } from 'lucide-angular';
import { SupabaseService } from './core/services/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LucideAngularModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly icons = { GraduationCap };
  private readonly supabase = inject(SupabaseService);

  ngOnInit(): void {
    console.log('Supabase client initialized:', !!this.supabase.client);
  }
}
