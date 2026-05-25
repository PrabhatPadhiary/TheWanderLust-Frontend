import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface CreateTripDto {
  name: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  coverPhotoUrl?: string | null;
  travelersCount?: number;
  primaryDestination?: string;
  destination?: {
    googlePlaceId: string;
    name: string;
    latitude: number;
    longitude: number;
    photoUrl?: string | null;
  };
}

export interface TripResponse {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  primaryDestination?: string;
  travelersCount?: number;
  description?: string;
  coverPhotoUrl?: string | null;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TripService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private tripsSubject = new BehaviorSubject<TripResponse[]>([]);
  public trips$ = this.tripsSubject.asObservable();

  private tripsLoaded = false;

  createTrip(dto: CreateTripDto): Observable<TripResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<TripResponse>(`${environment.apiUrl}/Trips`, dto, { headers })
          .subscribe({
            next: (res) => {
              // Push new trip into cache
              this.tripsSubject.next([...this.tripsSubject.value, res]);
              observer.next(res);
              observer.complete();
            },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  getTripByDestination(googlePlaceId: string): Observable<TripResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.get<TripResponse>(`${environment.apiUrl}/Trips/by-destination/${googlePlaceId}`, { headers })
          .subscribe({ next: (res) => { observer.next(res); observer.complete(); }, error: (err) => observer.error(err) });
      });
    });
  }

  getAllTrips(forceRefresh = false): Observable<TripResponse[]> {
    return new Observable(observer => {
      // Return cached data if already loaded and no force refresh
      if (this.tripsLoaded && !forceRefresh) {
        observer.next(this.tripsSubject.value);
        observer.complete();
        return;
      }

      // Wait for Firebase to restore auth state before attempting the request
      this.authService.authReady.then(() =>
        this.authService.getFirebaseToken()
      ).then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.get<TripResponse[]>(`${environment.apiUrl}/Trips`, { headers })
          .subscribe({
            next: (res) => {
              this.tripsSubject.next(res);
              this.tripsLoaded = true;
              observer.next(res);
              observer.complete();
            },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  getTrip(tripId: string): Observable<TripResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.get<TripResponse>(`${environment.apiUrl}/Trips/${tripId}`, { headers })
          .subscribe({ next: (res) => { observer.next(res); observer.complete(); }, error: (err) => observer.error(err) });
      });
    });
  }

  clearCache(): void {
    this.tripsLoaded = false;
    this.tripsSubject.next([]);
  }
}
