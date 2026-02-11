import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { FileUploadComponent } from './file-upload.component';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';

describe('FileUploadComponent', () => {
  it('should render drop zone when no file selected and no current file', async () => {
    await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {},
    });

    expect(screen.getByText('Drop file here or click to browse')).toBeTruthy();
  });

  it('should show current filename in edit mode', async () => {
    await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { currentFileName: 'existing-doc.pdf' },
    });

    expect(screen.getByText('existing-doc.pdf')).toBeTruthy();
    expect(screen.getByText('Replace')).toBeTruthy();
  });

  it('should emit fileSelected on valid file pick', async () => {
    const { fixture } = await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { accept: 'application/pdf', maxSizeMB: 50 },
    });

    let emittedFile: File | null = null;
    fixture.componentInstance.fileSelected.subscribe((f: File) => { emittedFile = f; });

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(emittedFile).not.toBeNull();
    expect(emittedFile!.name).toBe('test.pdf');
    expect(screen.getByText('test.pdf')).toBeTruthy();
  });

  it('should reject file exceeding maxSizeMB', async () => {
    const { fixture } = await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { maxSizeMB: 1 },
    });

    let emittedFile: File | null = null;
    fixture.componentInstance.fileSelected.subscribe((f: File) => { emittedFile = f; });

    // Create a file larger than 1MB
    const largeContent = new Uint8Array(2 * 1024 * 1024);
    const file = new File([largeContent], 'big.pdf', { type: 'application/pdf' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    fixture.detectChanges();

    expect(emittedFile).toBeNull();
    expect(screen.getByText('File exceeds 1 MB limit')).toBeTruthy();
  });

  it('should reject file with wrong MIME type', async () => {
    const { fixture } = await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { accept: 'application/pdf' },
    });

    let emittedFile: File | null = null;
    fixture.componentInstance.fileSelected.subscribe((f: File) => { emittedFile = f; });

    const file = new File(['content'], 'image.png', { type: 'image/png' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    fixture.detectChanges();

    expect(emittedFile).toBeNull();
    expect(screen.getByText(/File type not accepted/)).toBeTruthy();
  });

  it('should show progress bar when uploading', async () => {
    await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { uploading: true, progress: 45 },
    });

    expect(screen.getByText('Uploading... 45%')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('should show error message from parent', async () => {
    await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { error: 'Upload failed: network error' },
    });

    expect(screen.getByText('Upload failed: network error')).toBeTruthy();
  });

  it('should emit removeFile and show drop zone when replace clicked', async () => {
    const { fixture } = await render(FileUploadComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { currentFileName: 'old-file.pdf' },
    });

    let removed = false;
    fixture.componentInstance.removeFile.subscribe(() => { removed = true; });

    fireEvent.click(screen.getByText('Replace'));
    fixture.detectChanges();

    expect(removed).toBe(true);
    expect(screen.getByText('Drop file here or click to browse')).toBeTruthy();
  });
});
