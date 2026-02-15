import { ChangeDetectionStrategy, Component, input, output, signal, ViewChild, ElementRef } from '@angular/core';
import { LucideAngularModule, Upload, File, X, AlertCircle } from 'lucide-angular';

@Component({
  selector: 'app-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (currentFileName() && !selectedFile() && !replacing()) {
      <!-- Current file display -->
      <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <lucide-icon [img]="icons.File" [size]="20" class="text-slate-400 shrink-0"></lucide-icon>
        <span class="text-sm text-slate-700 truncate flex-1">{{ currentFileName() }}</span>
        <button
          type="button"
          (click)="onReplace()"
          class="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
        >
          Replace
        </button>
      </div>
    } @else if (!selectedFile()) {
      <!-- Drop zone -->
      <button
        type="button"
        (click)="fileInput.click()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
        class="w-full drop-zone"
        [class.drop-zone-active]="dragging()"
      >
        <lucide-icon [img]="icons.Upload" [size]="24" class="mx-auto text-slate-400 mb-2"></lucide-icon>
        <p class="text-sm text-slate-600">Drop file here or click to browse</p>
        @if (accept()) {
          <p class="text-xs text-slate-400 mt-1">Accepted: {{ accept() }}</p>
        }
      </button>
      <input
        #fileInput
        type="file"
        [accept]="accept()"
        (change)="onFileChange($event)"
        class="hidden"
      />
    } @else {
      <!-- Selected file -->
      <div class="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50/30 px-4 py-3">
        <lucide-icon [img]="icons.File" [size]="20" class="text-teal-500 shrink-0"></lucide-icon>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-700 truncate">{{ selectedFile()!.name }}</p>
          <p class="text-xs text-slate-500">{{ formatSize(selectedFile()!.size) }}</p>
        </div>
        <button
          type="button"
          (click)="onRemove()"
          class="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Remove file"
        >
          <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
        </button>
      </div>
    }

    @if (uploading()) {
      <div class="mt-2">
        <div class="progress-track">
          <div
            class="progress-fill"
            [style.width.%]="progress()"
            role="progressbar"
            [attr.aria-valuenow]="progress()"
            aria-valuemin="0"
            aria-valuemax="100"
          ></div>
        </div>
        <p class="text-xs text-slate-500 mt-1">Uploading... {{ progress() }}%</p>
      </div>
    }

    @if (validationError() || error()) {
      <div class="flex items-center gap-2 mt-2 text-sm text-rose-600">
        <lucide-icon [img]="icons.AlertCircle" [size]="14" class="shrink-0"></lucide-icon>
        <span>{{ validationError() || error() }}</span>
      </div>
    }
  `,
})
export class FileUploadComponent {
  readonly accept = input('');
  readonly maxSizeMB = input(50);
  readonly currentFileName = input<string | null>(null);
  readonly uploading = input(false);
  readonly progress = input(0);
  readonly error = input('');

  readonly fileSelected = output<File>();
  readonly removeFile = output<void>();

  readonly icons = { Upload, File, X, AlertCircle };

  readonly selectedFile = signal<File | null>(null);
  readonly validationError = signal('');
  readonly dragging = signal(false);
  readonly replacing = signal(false);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.#validateAndSelect(file);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.#validateAndSelect(file);
  }

  onReplace() {
    this.selectedFile.set(null);
    this.validationError.set('');
    this.replacing.set(true);
    this.removeFile.emit();
  }

  onRemove() {
    this.selectedFile.set(null);
    this.validationError.set('');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  #validateAndSelect(file: File) {
    this.validationError.set('');

    const maxBytes = this.maxSizeMB() * 1024 * 1024;
    if (file.size > maxBytes) {
      this.validationError.set(`File exceeds ${this.maxSizeMB()} MB limit`);
      return;
    }

    const acceptStr = this.accept();
    if (acceptStr) {
      const allowedTypes = acceptStr.split(',').map(t => t.trim());
      if (!allowedTypes.includes(file.type)) {
        this.validationError.set(`File type not accepted. Allowed: ${acceptStr}`);
        return;
      }
    }

    this.selectedFile.set(file);
    this.fileSelected.emit(file);
  }
}
