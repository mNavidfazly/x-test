import {
  ChangeDetectionStrategy, Component, inject, signal, OnInit, DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, Camera, Pencil, Check, X, Loader2, Trash2,
  Mail, Building2, Shield, Calendar, User,
} from 'lucide-angular';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { FullProfileData } from '../../../core/models/profile.model';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { formatDate } from '../../../core/utils/date.utils';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, ErrorAlertComponent],
  host: { class: 'block' },
  template: `
    <div class="max-w-2xl">
      <h1 class="page-title mb-6">Profile</h1>

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
          Loading profile...
        </div>
      } @else if (errorMessage()) {
        <app-error-alert [message]="errorMessage()!" />
      } @else if (profileData()) {
        <!-- Avatar Section -->
        <div class="flex flex-col items-center mb-8">
          <div class="relative group">
            @if (avatarPreview() || profileData()!.avatar_url) {
              <img
                [src]="avatarPreview() || profileData()!.avatar_url"
                alt="Profile photo"
                class="w-28 h-28 rounded-full object-cover border-2 border-slate-200"
              />
            } @else {
              <div class="w-28 h-28 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-3xl font-bold border-2 border-slate-200">
                {{ initials() }}
              </div>
            }

            <!-- Camera overlay -->
            <button
              type="button"
              (click)="fileInput.click()"
              [disabled]="avatarUploading()"
              class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer disabled:cursor-wait"
              aria-label="Upload photo"
            >
              @if (avatarUploading()) {
                <lucide-icon [img]="icons.Loader2" [size]="24" class="text-white animate-spin"></lucide-icon>
              } @else {
                <lucide-icon [img]="icons.Camera" [size]="24" class="text-white"></lucide-icon>
              }
            </button>

            <input
              #fileInput
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              (change)="onFileSelected($event)"
              class="hidden"
            />
          </div>

          @if (profileData()!.avatar_url && !avatarUploading()) {
            <button
              type="button"
              (click)="onRemoveAvatar()"
              class="mt-2 text-xs text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <lucide-icon [img]="icons.Trash2" [size]="12"></lucide-icon>
              Remove photo
            </button>
          }
        </div>

        <!-- Info Card -->
        <div class="form-card divide-y divide-slate-100">
          <!-- Full Name (editable) -->
          <div class="px-5 py-4 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <lucide-icon [img]="icons.User" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
              @if (editingName()) {
                <input
                  type="text"
                  [(ngModel)]="nameInput"
                  class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  (keydown.enter)="onSaveName()"
                  (keydown.escape)="editingName.set(false)"
                />
              } @else {
                <div class="min-w-0">
                  <p class="text-xs text-slate-500">Full Name</p>
                  <p class="text-sm font-medium text-slate-900 truncate">
                    {{ profileData()!.full_name || 'Not set' }}
                  </p>
                </div>
              }
            </div>
            <div class="flex items-center gap-1 shrink-0">
              @if (editingName()) {
                <button
                  type="button"
                  (click)="onSaveName()"
                  [disabled]="savingName()"
                  class="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-all duration-200 disabled:opacity-50"
                  aria-label="Save name"
                >
                  @if (savingName()) {
                    <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
                  } @else {
                    <lucide-icon [img]="icons.Check" [size]="16"></lucide-icon>
                  }
                </button>
                <button
                  type="button"
                  (click)="editingName.set(false)"
                  class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all duration-200"
                  aria-label="Cancel editing"
                >
                  <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="onStartEditName()"
                  class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all duration-200"
                  aria-label="Edit name"
                >
                  <lucide-icon [img]="icons.Pencil" [size]="16"></lucide-icon>
                </button>
              }
            </div>
          </div>

          <!-- Email (readonly) -->
          <div class="px-5 py-4 flex items-center gap-3">
            <lucide-icon [img]="icons.Mail" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <div class="min-w-0">
              <p class="text-xs text-slate-500">Email</p>
              <p class="text-sm font-medium text-slate-900 truncate">{{ profileData()!.email }}</p>
            </div>
          </div>

          <!-- Organization (readonly) -->
          <div class="px-5 py-4 flex items-center gap-3">
            <lucide-icon [img]="icons.Building2" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <div class="min-w-0">
              <p class="text-xs text-slate-500">Organization</p>
              <p class="text-sm font-medium text-slate-900 truncate">{{ profileData()!.tenant_name }}</p>
            </div>
          </div>

          <!-- Roles -->
          <div class="px-5 py-4 flex items-center gap-3">
            <lucide-icon [img]="icons.Shield" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <div class="min-w-0">
              <p class="text-xs text-slate-500">Roles</p>
              <div class="flex flex-wrap gap-1.5 mt-1">
                @for (role of roles(); track role) {
                  <span [class]="'badge ' + roleStyle(role)">
                    {{ role }}
                  </span>
                }
              </div>
            </div>
          </div>

          <!-- Member Since (readonly) -->
          <div class="px-5 py-4 flex items-center gap-3">
            <lucide-icon [img]="icons.Calendar" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <div class="min-w-0">
              <p class="text-xs text-slate-500">Member Since</p>
              <p class="text-sm font-medium text-slate-900">{{ formatDate(profileData()!.created_at) }}</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfilePageComponent implements OnInit {
  readonly icons = { Camera, Pencil, Check, X, Loader2, Trash2, Mail, Building2, Shield, Calendar, User };

  #profile = inject(ProfileService);
  #auth = inject(AuthService);
  #toast = inject(ToastService);
  #destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly profileData = signal<FullProfileData | null>(null);

  readonly editingName = signal(false);
  readonly savingName = signal(false);
  nameInput = '';

  readonly avatarUploading = signal(false);
  readonly avatarPreview = signal<string | null>(null);

  readonly formatDate = formatDate;

  readonly initials = signal('');
  readonly roles = signal<string[]>([]);

  async ngOnInit() {
    try {
      const data = await this.#profile.loadFullProfile();
      this.profileData.set(data);
      this.#computeInitials(data);
      this.#computeRoles(data);
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Failed to load profile'));
    } finally {
      this.loading.set(false);
    }
  }

  onStartEditName() {
    this.nameInput = this.profileData()?.full_name ?? '';
    this.editingName.set(true);
  }

  async onSaveName() {
    const trimmed = this.nameInput.trim();
    const current = this.profileData()?.full_name ?? '';
    if (trimmed === current) {
      this.editingName.set(false);
      return;
    }

    this.savingName.set(true);
    try {
      await this.#profile.updateName(trimmed);
      this.profileData.update(d => d ? { ...d, full_name: trimmed || null } : d);
      this.#computeInitials(this.profileData()!);
      this.editingName.set(false);
      this.#toast.success('Name updated');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to update name'));
    } finally {
      this.savingName.set(false);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    // Instant preview via FileReader
    const reader = new FileReader();
    reader.onload = () => {
      const oldPreview = this.avatarPreview();
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      this.avatarPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    this.avatarUploading.set(true);
    try {
      const signedUrl = await this.#profile.uploadAvatar(file);
      this.profileData.update(d => d ? { ...d, avatar_url: signedUrl } : d);
      this.avatarPreview.set(null);
      this.#toast.success('Avatar uploaded');
    } catch (err) {
      this.avatarPreview.set(null);
      this.#toast.error(extractErrorMessage(err, 'Failed to upload avatar'));
    } finally {
      this.avatarUploading.set(false);
    }
  }

  async onRemoveAvatar() {
    this.avatarUploading.set(true);
    try {
      await this.#profile.removeAvatar();
      this.profileData.update(d => d ? { ...d, avatar_url: null } : d);
      this.#toast.success('Avatar removed');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to remove avatar'));
    } finally {
      this.avatarUploading.set(false);
    }
  }

  roleStyle(role: string): string {
    switch (role) {
      case 'Platform Admin': return 'bg-purple-100 text-purple-700';
      case 'Tenant Admin': return 'bg-amber-100 text-amber-700';
      case 'CSM': return 'bg-blue-100 text-blue-700';
      case 'Lecturer': return 'bg-teal-100 text-teal-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  #computeInitials(data: FullProfileData) {
    const name = data.full_name;
    if (!name) {
      this.initials.set(data.email.charAt(0).toUpperCase());
      return;
    }
    this.initials.set(
      name.split(' ').map(p => p.charAt(0)).join('').toUpperCase().slice(0, 2),
    );
  }

  #computeRoles(data: FullProfileData) {
    const r: string[] = ['Learner'];
    if (data.is_tenant_admin) r.push('Tenant Admin');
    if (data.is_platform_admin) r.push('Platform Admin');

    const user = this.#auth.currentUser();
    if (user) {
      if (user.claims.csm_tenant_ids.length > 0) r.push('CSM');
      if (user.claims.lecturer_course_ids.length > 0) r.push('Lecturer');
    }

    this.roles.set(r);
  }
}
