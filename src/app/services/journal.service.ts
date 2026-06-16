import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface CreateJournalPlaceDto {
  placeName: string;
  category: string;
  googlePlaceId?: string | null;
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
  vibes?: string[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  publishedAt: string;
  createdAt: string;
  author: { id: string; name: string };
  places: { id: string; placeName: string; category: string; googlePlaceId?: string | null }[];
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
  places: { id: string; placeName: string; category: string; googlePlaceId?: string | null }[];
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

@Injectable({
  providedIn: 'root'
})
export class JournalService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  getFeed(): Observable<JournalFeedItem[]> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        const headers = token
          ? new HttpHeaders({ Authorization: `Bearer ${token}` })
          : new HttpHeaders();
        this.http.get<JournalFeedItem[]>(`${environment.apiUrl}/Journals/feed`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
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

  uploadPhotos(journalId: string, files: File[]): Observable<any> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file, file.name);
        });
        this.http.post<any>(`${environment.apiUrl}/Journals/${journalId}/photos`, formData, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }
}
