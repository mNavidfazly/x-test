import { ChangeDetectionStrategy, Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import { TiptapEditorDirective } from 'ngx-tiptap';

const lowlight = createLowlight(common);

@Component({
  selector: 'app-tiptap-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TiptapEditorDirective],
  host: { class: 'block' },
  template: `
    <div class="border border-slate-300 rounded-lg overflow-hidden transition-all duration-200" [class.border-teal-500]="focused()" [class.ring-2]="focused()" [class.ring-teal-500]="focused()">
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
  `,
})
export class TiptapEditorComponent implements OnInit, OnDestroy {
  readonly content = input('');
  readonly placeholder = input('Start writing...');
  readonly editable = input(true);

  readonly contentChange = output<string>();

  readonly focused = signal(false);

  editor: Editor | null = null;

  ngOnInit() {
    this.editor = new Editor({
      content: this.content(),
      editable: this.editable(),
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
        Link.configure({ openOnClick: false }),
        Markdown.configure({ html: false }),
      ],
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
}
