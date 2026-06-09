import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface CreateTripPlaceDto {
  placeId: string;
  placeName: string;
  vicinity?: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  photoUrl?: string | null;
  category: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface TripPlaceResponse {
  id: string;
  placeId: string;
  placeName: string;
  category: string;
}

export interface CreateTripDestinationDto {
  googlePlaceId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string | null;
  order?: number;
  startDate?: string | null;
  endDate?: string | null;
}

export interface TripDestinationResponse {
  id: string;
  googlePlaceId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string | null;
  order?: number;
  startDate?: string | null;
  endDate?: string | null;
  places?: TripPlaceDetailResponse[];
}

export interface TripPlaceDetailResponse {
  id: string;
  placeId: string;
  placeName: string;
  vicinity?: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  photoUrl?: string | null;
  category: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
}

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
    startDate?: string | null;
    endDate?: string | null;
  };
}

export interface TripMemberResponse {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface TripExpenseResponse {
  id: string;
  title: string;
  amount: number;
  category: 'stay' | 'food' | 'activity' | 'transport' | 'other';
  date: string;
  paidByMemberId: string;
  paidByName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripExpenseDto {
  title: string;
  amount: number;
  category: string;
  date: string;
  paidByMemberId: string;
  paidByName: string;
  notes?: string;
}

export interface UpdateTripExpenseDto extends CreateTripExpenseDto {}

export interface SetTripBudgetDto {
  totalBudget: number;
  currency?: string;
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
  totalBudget?: number | null;
  currency?: string | null;
  destinations?: TripDestinationResponse[];
  members?: TripMemberResponse[];
  placeIds?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TripService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private tripsSubject = new BehaviorSubject<TripResponse[]>([]);
  public trips$ = this.tripsSubject.asObservable();

  get tripsCache(): TripResponse[] {
    return this.tripsSubject.value;
  }

  addPlaceIdToTrip(tripId: string, placeId: string): void {
    const trips = this.tripsSubject.value;
    const trip = trips.find(t => t.id === tripId);
    if (trip) {
      if (!trip.placeIds) trip.placeIds = [];
      if (!trip.placeIds.includes(placeId)) {
        trip.placeIds.push(placeId);
        this.tripsSubject.next([...trips]);
      }
    }
  }

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
      this.authService.authReady.then(() =>
        this.authService.getFirebaseToken().then(token => {
          if (!token) { observer.error('Not authenticated'); return; }
          const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
          this.http.get<TripResponse>(`${environment.apiUrl}/Trips/${tripId}`, { headers })
            .subscribe({ next: (res) => { observer.next(res); observer.complete(); }, error: (err) => observer.error(err) });
        })
      );
    });
  }

  clearCache(): void {
    this.tripsLoaded = false;
    this.tripsSubject.next([]);
  }

  addDestination(tripId: string, dto: CreateTripDestinationDto): Observable<TripDestinationResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<TripDestinationResponse>(`${environment.apiUrl}/Trips/${tripId}/destinations`, dto, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  addPlace(tripId: string, destinationId: string, dto: CreateTripPlaceDto): Observable<TripPlaceResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<TripPlaceResponse>(
          `${environment.apiUrl}/Trips/${tripId}/destinations/${destinationId}/places`,
          dto, { headers }
        ).subscribe({
          next: (res) => { observer.next(res); observer.complete(); },
          error: (err) => observer.error(err)
        });
      });
    });
  }

  deleteTrip(tripId: string): Observable<void> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.delete<void>(`${environment.apiUrl}/Trips/${tripId}`, { headers })
          .subscribe({
            next: (res) => {
              // Remove from cache
              this.tripsSubject.next(this.tripsSubject.value.filter(t => t.id !== tripId));
              observer.next(res);
              observer.complete();
            },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  deleteDestination(tripId: string, destinationId: string): Observable<void> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.delete<void>(`${environment.apiUrl}/Trips/${tripId}/destinations/${destinationId}`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  deletePlace(placeId: string): Observable<void> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.delete<void>(`${environment.apiUrl}/trip-places/${placeId}`, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  joinTrip(tripId: string): Observable<TripResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<TripResponse>(`${environment.apiUrl}/Trips/${tripId}/join`, {}, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  updateTrip(tripId: string, dto: { name?: string; startDate?: string | null; endDate?: string | null; travelersCount?: number; status?: string }): Observable<TripResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.put<TripResponse>(`${environment.apiUrl}/Trips/${tripId}`, dto, { headers })
          .subscribe({
            next: (res) => { observer.next(res); observer.complete(); },
            error: (err) => observer.error(err)
          });
      });
    });
  }

  // ===== EXPENSES =====

  getExpenses(tripId: string): Observable<TripExpenseResponse[]> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.get<TripExpenseResponse[]>(`${environment.apiUrl}/Trips/${tripId}/expenses`, { headers })
          .subscribe({ next: res => { observer.next(res); observer.complete(); }, error: err => observer.error(err) });
      });
    });
  }

  addExpense(tripId: string, dto: CreateTripExpenseDto): Observable<TripExpenseResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.post<TripExpenseResponse>(`${environment.apiUrl}/Trips/${tripId}/expenses`, dto, { headers })
          .subscribe({ next: res => { observer.next(res); observer.complete(); }, error: err => observer.error(err) });
      });
    });
  }

  updateExpense(tripId: string, expenseId: string, dto: UpdateTripExpenseDto): Observable<TripExpenseResponse> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.put<TripExpenseResponse>(`${environment.apiUrl}/Trips/${tripId}/expenses/${expenseId}`, dto, { headers })
          .subscribe({ next: res => { observer.next(res); observer.complete(); }, error: err => observer.error(err) });
      });
    });
  }

  deleteExpense(tripId: string, expenseId: string): Observable<void> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.delete<void>(`${environment.apiUrl}/Trips/${tripId}/expenses/${expenseId}`, { headers })
          .subscribe({ next: res => { observer.next(res); observer.complete(); }, error: err => observer.error(err) });
      });
    });
  }

  // ===== BUDGET =====

  setBudget(tripId: string, dto: SetTripBudgetDto): Observable<{ totalBudget: number; currency?: string }> {
    return new Observable(observer => {
      this.authService.getFirebaseToken().then(token => {
        if (!token) { observer.error('Not authenticated'); return; }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        this.http.put<{ totalBudget: number; currency?: string }>(`${environment.apiUrl}/Trips/${tripId}/budget`, dto, { headers })
          .subscribe({ next: res => { observer.next(res); observer.complete(); }, error: err => observer.error(err) });
      });
    });
  }
}
