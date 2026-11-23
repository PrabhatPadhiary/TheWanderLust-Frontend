import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface CreateJournalPlaceDto {
  placeName: string;
  category: string;
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateJournalDto {
  title: string;
  body: string;
  tripId?: string | null;
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  travelersCount?: number | null;
  budget?: number | null;
  currency?: string | null;
  visibility: string;
  vibes?: string[];
  proTips?: string | null;
  status: string;
  places?: CreateJournalPlaceDto[];
}

export interface JournalResponse {
  id: string;
  title: string;
  status: string;
  visibility: string;
  createdAt: string;
}

export interface JournalFeedItem {
  id: string;
  title: string;
  body: string;
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  travelersCount?: number | null;
  budget?: number | null;
  currency?: string | null;
  proTips?: string | null;
  /** The feed sends "a,b,c"; use vibesOf() to get a list. */
  vibes?: string | string[] | null;
  status?: string;
  visibility?: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  publishedAt: string;
  createdAt: string;
  author: { id: string; name: string };
  places: { id: string; placeName: string; category: string; googlePlaceId?: string | null; latitude?: number | null; longitude?: number | null }[];
  photos?: { id: string; url: string; order: number }[];
}

export interface JournalComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface JournalDetail {
  id: string;
  userId: string;
  tripId?: string | null;
  title: string;
  body: string;
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  travelersCount?: number | null;
  budget?: number | null;
  currency?: string | null;
  proTips?: string | null;
  vibes: string[];
  visibility: string;
  status: string;
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  publishedAt: string;
  createdAt: string;
  author: { id: string; name: string };
  places: { id: string; placeName: string; category: string; googlePlaceId?: string | null; latitude?: number | null; longitude?: number | null }[];
  photos: { id: string; url: string; caption?: string | null; order: number }[];
  comments: JournalComment[];
}

export interface PostCommentDto {
  body: string;
}

export interface PostCommentResponse {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface ToggleLikeResponse {
  liked: boolean;
  likesCount: number;
}

/** Reasons someone can report a story for (same as the app). */
export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam or advertising' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'false_info', label: 'False or misleading' },
  { key: 'other', label: 'Something else' },
];

const VIBE_LABELS = ['Adventure', 'Relaxing', 'Foodie', 'Cultural', 'Budget', 'Luxury', 'Solo', 'Group', 'Road Trip', 'Nature'];

/** Vibes as a list, whether they came as "a,b,c" (feed) or an array (story). */
export function vibesOf(raw: string | string[] | null | undefined): string[] {
  const list = Array.isArray(raw) ? raw : (raw || '').split(',');
  return list.map(v => (v || '').trim().toLowerCase()).filter(Boolean);
}

/** "road trip" -> "Road Trip". */
export function vibeLabel(vibe: string): string {
  const v = (vibe || '').trim().toLowerCase();
  return VIBE_LABELS.find(x => x.toLowerCase() === v) || v.replace(/\b\w/g, c => c.toUpperCase());
}

/** The public link to a story. */
export function storyUrl(id: string): string {
  return `https://wayraa.com/community/story/${id}`;
}

/** Someone you've blocked (Settings → Blocked people). */
export interface BlockedPerson {
  id: string;
  name: string;
  photoUrl?: string | null;
  blockedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class JournalService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  /** The last feed loaded in this visit (dropped when someone signs in or out: likes differ). */
  private feedCache: JournalFeedItem[] | null = null;
  private feedCacheUser: string | null | undefined = undefined;

  /** The last feed loaded, to show at once while a fresh one loads (null if none yet). */
  peekFeed(): JournalFeedItem[] | null {
    return this.feedCacheUser === (this.authService.currentUser?.id ?? null) ? this.feedCache : null;
  }

  getFeed(): Observable<JournalFeedItem[]> {
    return new Observable<JournalFeedItem[]>(observer => {
      this.authService.getFirebaseToken().then(token => {
        const headers = token
          ? new HttpHeaders({ Authorization: `Bearer ${token}` })
          : new HttpHeaders();
        this.http.get<JournalFeedItem[]>(`${environment.apiUrl}/Journals/feed`, { headers })
          .subscribe({
            next: (res) => {
              this.feedCache = res;
              this.feedCacheUser = this.authService.currentUser?.id ?? null;
              observer.next(res); observer.complete();
            },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  createJournal(dto: CreateJournalDto): Observable<JournalResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<JournalResponse>(`${environment.apiUrl}/Journals`, dto, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  getById(journalId: string): Observable<JournalDetail> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        const headers = token
          ? new HttpHeaders({ Authorization: `Bearer ${token}` })
          : new HttpHeaders();
        this.http.get<JournalDetail>(`${environment.apiUrl}/Journals/${journalId}`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  postComment(journalId: string, body: string): Observable<PostCommentResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<PostCommentResponse>(
          `${environment.apiUrl}/Journals/${journalId}/comments`,
          { body },
          { headers }
        ).subscribe({
          next: (res) => { observer.next(res); observer.complete(); },
          error: (err) => observer.error(err)
        });
      });
    });
  }

  toggleLike(journalId: string): Observable<ToggleLikeResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<ToggleLikeResponse>(`${environment.apiUrl}/Journals/${journalId}/like`, {}, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  /**
   * Upload a story's photos one at a time (one big request with several 5 MB
   * photos goes over the server's request size limit, and the server takes at
   * most 10 per request). Emits how many went up and how many failed.
   */
  uploadPhotos(journalId: string, files: File[]): Observable<{ uploaded: number; failed: number }> {
    return new Observable(observer => {
      (async () => {
        let uploaded = 0;
        let failed = 0;
        for (const file of files) {
          try {
            // A fresh token each time: a long upload can outlast one.
            const token = await this.authService.getFirebaseToken();
            if (!token) throw new Error('Not authenticated');
            const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
            const formData = new FormData();
            formData.append('files', file, file.name);
            await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/Journals/${journalId}/photos`, formData, { headers }));
            uploaded++;
          } catch {
            failed++;
          }
        }
        observer.next({ uploaded, failed });
        observer.complete();
      })();
    });
  }

  /** Remove one photo from your story. */
  deletePhoto(journalId: string, photoId: string): Observable<any> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.delete<any>(`${environment.apiUrl}/Journals/${journalId}/photos/${photoId}`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  getMyJournals(): Observable<JournalFeedItem[]> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.get<JournalFeedItem[]>(`${environment.apiUrl}/Journals/mine`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  deleteJournal(journalId: string): Observable<void> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.delete<void>(`${environment.apiUrl}/Journals/${journalId}`, { headers })
          .subscribe({
            next: () => { observer.next(); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  updateJournal(journalId: string, dto: CreateJournalDto): Observable<any> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.put<any>(`${environment.apiUrl}/Journals/${journalId}`, dto, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  /** A signed-in request (errors with 'Not authenticated' when signed out). */
  private authed<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Observable<T> {
    return new Observable<T>(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.request<T>(method, `${environment.apiUrl}${path}`, { headers, body })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  /** Show your story in Community ('public') or hide it ('private'). */
  setVisibility(journalId: string, visibility: 'public' | 'private'): Observable<unknown> {
    return this.authed('PUT', `/Journals/${journalId}`, { visibility });
  }

  /** Delete one of your comments. */
  deleteComment(journalId: string, commentId: string): Observable<unknown> {
    return this.authed('DELETE', `/Journals/${journalId}/comments/${commentId}`);
  }

  /** Report a story (it also leaves your feed). */
  report(journalId: string, reason: string): Observable<unknown> {
    return this.authed('POST', `/Journals/${journalId}/report`, { reason, details: null });
  }

  /** "Not interested": hide a story from your feed. */
  hide(journalId: string): Observable<unknown> {
    return this.authed('POST', `/Journals/${journalId}/hide`);
  }

  /** Undo "Not interested". */
  unhide(journalId: string): Observable<unknown> {
    return this.authed('DELETE', `/Journals/${journalId}/hide`);
  }

  /** Block someone: their stories and comments are hidden from you. */
  blockUser(userId: string): Observable<unknown> {
    return this.authed('POST', `/users/${userId}/block`);
  }

  unblockUser(userId: string): Observable<unknown> {
    return this.authed('DELETE', `/users/${userId}/block`);
  }

  getBlockedUsers(): Observable<BlockedPerson[]> {
    return this.authed('GET', '/users/me/blocked');
  }

  /** Public stories that tagged a place (Google place id), newest first. Works signed out. */
  getForPlace(googlePlaceId: string, limit = 10): Observable<JournalFeedItem[]> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
        this.http.get<JournalFeedItem[]>(`${environment.apiUrl}/Journals/by-place/${encodeURIComponent(googlePlaceId)}?limit=${limit}`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }
}
