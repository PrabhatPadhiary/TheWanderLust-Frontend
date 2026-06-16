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
  likesCount: number;
  commentsCount: number;
  publishedAt: string;
  createdAt: string;
  author: { id: string; name: string };
  places: { id: string; placeName: string; category: string; googlePlaceId?: string | null }[];
  photos?: { id: string; url: string; order: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class JournalService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  getFeed(): Observable<JournalFeedItem[]> {
    return this.http.get<JournalFeedItem[]>(`${environment.apiUrl}/Journals/feed`);
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
