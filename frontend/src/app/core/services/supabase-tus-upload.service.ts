import { inject, Injectable, signal } from '@angular/core';
import * as tus from 'tus-js-client';
import { KeycloakService } from './keycloak.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseTusUploadService {
  readonly #keycloak = inject(KeycloakService);

  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly error = signal<string | null>(null);
  readonly uploadedPath = signal<string | null>(null);

  #currentUpload: tus.Upload | null = null;

  async upload(bucket: string, path: string, file: File): Promise<string> {
    const token = this.#keycloak.getToken();
    if (!token) throw new Error('Not authenticated');

    this.uploading.set(true);
    this.progress.set(0);
    this.error.set(null);
    this.uploadedPath.set(null);

    // Direct storage hostname bypasses Kong API gateway (critical for large files)
    const projectId = environment.supabaseUrl.match(/\/\/([^.]+)/)?.[1];
    const endpoint = `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;

    return new Promise<string>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 6 * 1024 * 1024,              // REQUIRED by Supabase — exactly 6MB
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          authorization: `Bearer ${token}`,
          'x-upsert': 'false',
        },
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type,
        },
        onError: (err) => {
          this.uploading.set(false);
          this.error.set(err.message);
          this.#currentUpload = null;
          reject(err);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          this.progress.set(Math.round((bytesUploaded / bytesTotal) * 100));
        },
        onSuccess: () => {
          this.uploading.set(false);
          this.progress.set(100);
          this.uploadedPath.set(path);
          this.#currentUpload = null;
          resolve(path);
        },
      });

      this.#currentUpload = upload;

      // Enable actual resumability
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  }

  abort(): void {
    this.#currentUpload?.abort();
    this.#currentUpload = null;
    this.uploading.set(false);
    this.progress.set(0);
  }

  reset(): void {
    this.abort();
    this.error.set(null);
    this.uploadedPath.set(null);
  }
}
