import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import * as tus from 'tus-js-client';

import { BunnyUploadCredentials, BunnyVideoStatus } from '../models/course.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class BunnyUploadService {
  readonly #api = inject(ApiService);

  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly error = signal('');
  readonly uploadedVideoId = signal<string | null>(null);
  readonly uploadedLibraryId = signal<number>(0);

  #currentUpload: tus.Upload | null = null;

  initAndUpload(file: File, title: string, courseId: string): void {
    this.reset();
    this.uploading.set(true);

    this.#api
      .post<BunnyUploadCredentials>('/video/init-upload', { title, course_id: courseId })
      .subscribe({
        next: (creds) => this.#startTusUpload(file, creds),
        error: (err) => {
          this.uploading.set(false);
          this.error.set(err?.error?.detail || 'Failed to initialize upload');
        },
      });
  }

  pollStatus(videoId: string): Observable<BunnyVideoStatus> {
    return this.#api.get<BunnyVideoStatus>(`/video/${videoId}/status`);
  }

  deleteVideo(videoId: string): Observable<void> {
    return this.#api.delete<void>(`/video/${videoId}`);
  }

  abort(): void {
    if (this.#currentUpload) {
      this.#currentUpload.abort();
      this.#currentUpload = null;
    }
    this.uploading.set(false);
  }

  reset(): void {
    this.abort();
    this.progress.set(0);
    this.error.set('');
    this.uploadedVideoId.set(null);
    this.uploadedLibraryId.set(0);
  }

  #startTusUpload(file: File, creds: BunnyUploadCredentials): void {
    this.#currentUpload = new tus.Upload(file, {
      endpoint: creds.tus_endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: creds.auth_signature,
        AuthorizationExpire: String(creds.auth_expire),
        VideoId: creds.video_id,
        LibraryId: String(creds.library_id),
      },
      metadata: {
        filetype: file.type,
        title: file.name,
      },
      onError: (err) => {
        this.uploading.set(false);
        this.error.set(err.message || 'Upload failed');
        this.#currentUpload = null;
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        this.progress.set(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => {
        this.uploading.set(false);
        this.progress.set(100);
        this.uploadedVideoId.set(creds.video_id);
        this.uploadedLibraryId.set(creds.library_id);
        this.#currentUpload = null;
      },
    });

    this.#currentUpload.start();
  }
}
