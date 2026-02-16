import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild, OnInit, OnDestroy } from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { LucideAngularModule, ImagePlus, Loader2 } from 'lucide-angular';
import { compressImage } from '../../core/utils/image.utils';

const lowlight = createLowlight(common);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

@Component({
  selector: 'app-tiptap-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TiptapEditorDirective, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="border border-slate-300 rounded-lg overflow-hidden transition-[border-color,box-shadow] duration-200" [class.border-teal-500]="focused()" [class.ring-2]="focused()" [class.ring-teal-500]="focused()">
      @if (editor) {
        <!-- Toolbar -->
        <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50 flex-wrap">
          <!-- Text formatting -->
          <button type="button" (click)="editor.chain().focus().toggleBold().run()" [class.bg-slate-200]="editor.isActive('bold')" [class.text-teal-600]="editor.isActive('bold')" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Bold">
            <span class="text-xs font-bold">B</span>
          </button>
          <button type="button" (click)="editor.chain().focus().toggleItalic().run()" [class.bg-slate-200]="editor.isActive('italic')" [class.text-teal-600]="editor.isActive('italic')" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Italic">
            <span class="text-xs italic">I</span>
          </button>
          <button type="button" (click)="editor.chain().focus().toggleStrike().run()" [class.bg-slate-200]="editor.isActive('strike')" [class.text-teal-600]="editor.isActive('strike')" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Strikethrough">
            <span class="text-xs line-through">S</span>
          </button>

          <div class="w-px h-5 bg-slate-200 mx-1"></div>

          <!-- Headings -->
          <button type="button" (click)="editor.chain().focus().toggleHeading({ level: 2 }).run()" [class.bg-slate-200]="editor.isActive('heading', { level: 2 })" [class.text-teal-600]="editor.isActive('heading', { level: 2 })" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Heading 2">
            <span class="text-xs font-bold">H2</span>
          </button>
          <button type="button" (click)="editor.chain().focus().toggleHeading({ level: 3 }).run()" [class.bg-slate-200]="editor.isActive('heading', { level: 3 })" [class.text-teal-600]="editor.isActive('heading', { level: 3 })" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Heading 3">
            <span class="text-xs font-bold">H3</span>
          </button>

          <div class="w-px h-5 bg-slate-200 mx-1"></div>

          <!-- Lists -->
          <button type="button" (click)="editor.chain().focus().toggleBulletList().run()" [class.bg-slate-200]="editor.isActive('bulletList')" [class.text-teal-600]="editor.isActive('bulletList')" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Bullet List">
            <span class="text-xs">&#8226;</span>
          </button>
          <button type="button" (click)="editor.chain().focus().toggleOrderedList().run()" [class.bg-slate-200]="editor.isActive('orderedList')" [class.text-teal-600]="editor.isActive('orderedList')" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Ordered List">
            <span class="text-xs">1.</span>
          </button>

          <div class="w-px h-5 bg-slate-200 mx-1"></div>

          <!-- Code block -->
          <button type="button" (click)="editor.chain().focus().toggleCodeBlock().run()" [class.bg-slate-200]="editor.isActive('codeBlock')" [class.text-teal-600]="editor.isActive('codeBlock')" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600" title="Code Block">
            <span class="text-xs font-mono">&lt;/&gt;</span>
          </button>

          @if (uploadHandler()) {
            <div class="w-px h-5 bg-slate-200 mx-1"></div>

            <!-- Image upload -->
            <button type="button" (click)="openFilePicker()" [disabled]="uploading()" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Insert Image">
              @if (uploading()) {
                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
              } @else {
                <lucide-icon [img]="icons.ImagePlus" [size]="14"></lucide-icon>
              }
            </button>
          }

          <div class="w-px h-5 bg-slate-200 mx-1"></div>

          <!-- Undo / Redo -->
          <button type="button" (click)="editor.chain().focus().undo().run()" [disabled]="!editor.can().undo()" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Undo">
            <span class="text-xs">&#8617;</span>
          </button>
          <button type="button" (click)="editor.chain().focus().redo().run()" [disabled]="!editor.can().redo()" class="p-1.5 rounded hover:bg-slate-200 transition-colors duration-150 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Redo">
            <span class="text-xs">&#8618;</span>
          </button>
        </div>

        <!-- Editor area -->
        <div tiptap [editor]="editor" class="prose prose-slate prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]"></div>
      }
    </div>

    <!-- Hidden file input for image upload -->
    <input #imgFileInput type="file" accept="image/*" class="hidden" (change)="onImageFileSelected($event)" />
  `,
})
export class TiptapEditorComponent implements OnInit, OnDestroy {
  readonly content = input('');
  readonly placeholder = input('Start writing...');
  readonly editable = input(true);
  readonly uploadHandler = input<((file: File) => Promise<string>) | null>(null);

  readonly contentChange = output<string>();

  readonly focused = signal(false);
  readonly uploading = signal(false);

  readonly icons = { ImagePlus, Loader2 };

  private imgFileInput = viewChild<ElementRef<HTMLInputElement>>('imgFileInput');

  editor: Editor | null = null;

  ngOnInit() {
    this.editor = new Editor({
      content: this.content(),
      editable: this.editable(),
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
        Link.configure({ openOnClick: false }),
        Image.configure({ inline: false, allowBase64: false }),
        Markdown.configure({ html: false }),
      ],
      editorProps: {
        handleDrop: (view, event, _slice, moved) => {
          if (moved || !this.uploadHandler()) return false;
          const files = event.dataTransfer?.files;
          if (!files?.length) return false;
          const imageFile = Array.from(files).find(f => IMAGE_TYPES.includes(f.type));
          if (!imageFile) return false;
          event.preventDefault();
          this.#processImageFile(imageFile);
          return true;
        },
        handlePaste: (_view, event) => {
          if (!this.uploadHandler()) return false;
          const files = event.clipboardData?.files;
          if (!files?.length) return false;
          const imageFile = Array.from(files).find(f => IMAGE_TYPES.includes(f.type));
          if (!imageFile) return false;
          event.preventDefault();
          this.#processImageFile(imageFile);
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        this.contentChange.emit(editor.storage['markdown'].getMarkdown());
      },
      onFocus: () => {
        this.focused.set(true);
      },
      onBlur: () => {
        this.focused.set(false);
      },
    });
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  openFilePicker() {
    this.imgFileInput()?.nativeElement.click();
  }

  onImageFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.#processImageFile(file);
  }

  async #processImageFile(file: File) {
    const handler = this.uploadHandler();
    if (!handler || !this.editor) return;

    if (!IMAGE_TYPES.includes(file.type)) return;
    if (file.size > MAX_IMAGE_SIZE) return;

    this.uploading.set(true);
    try {
      const compressed = await compressImage(file, 1200);
      const url = await handler(compressed);
      this.editor.chain().focus().setImage({ src: url }).run();
    } finally {
      this.uploading.set(false);
    }
  }
}
