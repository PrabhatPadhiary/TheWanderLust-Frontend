import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** GET /api/users/me: you and your travel stats. */
export interface MyProfile {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  createdAt: string;
  stats: {
    trips: number;
    upcomingTrips: number;
    completedTrips: number;
    destinations: number;
    placesSaved: number;
    favourites: number;
    journals: number;
  };
}

export interface BlockedPerson {
  id: string;
  name: string | null;
  photoUrl: string | null;
  blockedAt: string;
}

/**
 * Your account, the same as the app's Profile and Settings: profile and
 * stats, name and photo, people you've blocked, and deleting the account.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = `${environment.apiUrl}/users`;

  /** Run a request with your sign-in token. */
  private authed<T>(make: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    return from(this.auth.getFirebaseToken()).pipe(
      switchMap(token => make(new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {}))),
    );
  }

  getMe(): Observable<MyProfile> {
    return this.authed(headers => this.http.get<MyProfile>(`${this.base}/me`, { headers })).pipe(
      tap(me => this.auth.updateStoredUser({ name: me.name, photoUrl: me.photoUrl ?? null })),
    );
  }

  updateName(name: string): Observable<{ name: string }> {
    return this.authed(headers => this.http.put<{ name: string }>(`${this.base}/me`, { name }, { headers })).pipe(
      tap(u => this.auth.updateStoredUser({ name: u.name })),
    );
  }

  uploadPhoto(file: File): Observable<{ photoUrl: string }> {
    const form = new FormData();
    form.append('file', file, file.name || 'profile.jpg');
    return this.authed(headers => this.http.post<{ photoUrl: string }>(`${this.base}/me/photo`, form, { headers })).pipe(
      tap(r => this.auth.updateStoredUser({ photoUrl: r.photoUrl })),
    );
  }

  removePhoto(): Observable<unknown> {
    return this.authed(headers => this.http.delete(`${this.base}/me/photo`, { headers })).pipe(
      tap(() => this.auth.updateStoredUser({ photoUrl: null })),
    );
  }

  getBlocked(): Observable<BlockedPerson[]> {
    return this.authed(headers => this.http.get<BlockedPerson[]>(`${this.base}/me/blocked`, { headers }));
  }

  unblock(userId: string): Observable<unknown> {
    return this.authed(headers => this.http.delete(`${this.base}/${userId}/block`, { headers }));
  }

  /** Delete the account and its data (shared trips pass to another member). */
  deleteAccount(): Observable<unknown> {
    return this.authed(headers => this.http.delete(`${this.base}/me`, { headers })).pipe(
      tap(() => { this.auth.clearAfterDelete(); }),
    );
  }
}
