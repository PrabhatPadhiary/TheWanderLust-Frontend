import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

export interface JournalUploadState {
  status: UploadStatus;
  journalId: string | null;
  title: string | null;
}

@Injectable({ providedIn: 'root' })
export class JournalUploadStateService {
  private state$ = new BehaviorSubject<JournalUploadState>({
    status: 'idle',
    journalId: null,
    title: null
  });

  readonly upload$ = this.state$.asObservable();

  get snapshot(): JournalUploadState {
    return this.state$.value;
  }

  setUploading(journalId: string, title: string): void {
    this.state$.next({ status: 'uploading', journalId, title });
  }

  setDone(): void {
    this.state$.next({ ...this.state$.value, status: 'done' });
    // Auto-clear after 3 s so the banner dismisses itself
    setTimeout(() => this.clear(), 3000);
  }

  setError(): void {
    this.state$.next({ ...this.state$.value, status: 'error' });
    setTimeout(() => this.clear(), 4000);
  }

  clear(): void {
    this.state$.next({ status: 'idle', journalId: null, title: null });
  }
}
