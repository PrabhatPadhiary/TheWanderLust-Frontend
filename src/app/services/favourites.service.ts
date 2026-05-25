import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { ToastrService } from 'ngx-toastr';

export interface FavouriteItem {
  placeId: string;
  placeName: string;
  vicinity: string;
  rating: number | null;
  userRatingsTotal: number | null;
  photoUrl: string | null;
  category: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FavouritesService {
  private readonly STORAGE_KEY = 'wanderlust_favourites';
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);

  private favouritesSubject = new BehaviorSubject<FavouriteItem[]>([]);
  public favourites$ = this.favouritesSubject.asObservable();
  private favouritesLoaded = false;

  constructor() {
    this.loadFromStorage();
    this.authService.registerLogoutCallback(() => this.clearAll());
  }

  get favourites(): FavouriteItem[] {
    return this.favouritesSubject.value;
  }

  isFavourite(placeId: string): boolean {
    return this.favouritesSubject.value.some(f => f.placeId === placeId);
  }

  toggle(item: FavouriteItem): void {
    if (this.isFavourite(item.placeId)) {
      this.remove(item.placeId);
    } else {
      this.add(item);
    }
  }

  add(item: FavouriteItem): void {
    if (this.isFavourite(item.placeId)) return;

    const updated = [...this.favouritesSubject.value, { ...item, createdAt: new Date().toISOString() }];
    this.favouritesSubject.next(updated);
    this.persist(updated);
    this.toastr.success('Added to favourites');

    if (this.authService.isLoggedIn) {
      this.authService.getFirebaseToken().then(token => {
        if (token) {
          const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
          this.http.post(`${environment.apiUrl}/Favourites`, item, { headers }).subscribe();
        }
      });
    }
  }

  remove(placeId: string): void {
    const item = this.favouritesSubject.value.find(f => f.placeId === placeId);
    const updated = this.favouritesSubject.value.filter(f => f.placeId !== placeId);
    this.favouritesSubject.next(updated);
    this.persist(updated);
    if (item) {
      this.toastr.info('Removed from favourites');
    }

    if (this.authService.isLoggedIn) {
      this.authService.getFirebaseToken().then(token => {
        if (token) {
          const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
          this.http.delete(`${environment.apiUrl}/Favourites/${placeId}`, { headers }).subscribe();
        }
      });
    }
  }

  // Load favourites - from API if logged in, otherwise localStorage
  loadFavourites(forceRefresh = false): void {
    if (this.favouritesLoaded && !forceRefresh) return;

    if (this.authService.isLoggedIn) {
      this.authService.authReady.then(() => this.authService.getFirebaseToken()).then(token => {
        if (token) {
          const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
          this.http.get<FavouriteItem[]>(`${environment.apiUrl}/Favourites`, { headers }).subscribe({
            next: (items) => {
              this.favouritesSubject.next(items);
              this.persist(items);
              this.favouritesLoaded = true;
            },
            error: () => {
              this.loadFromStorage();
            }
          });
        }
      });
    } else {
      this.loadFromStorage();
      this.favouritesLoaded = true;
    }
  }

  // Merge localStorage favourites to backend on login
  mergeOnLogin(): void {
    const local = this.getFromStorage();
    if (local.length > 0) {
      this.authService.getFirebaseToken().then(token => {
        if (token) {
          const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
          this.http.post(`${environment.apiUrl}/Favourites/sync`, { favourites: local }, { headers }).subscribe({
            next: () => {
              localStorage.removeItem(this.STORAGE_KEY);
              this.loadFavourites();
              this.toastr.success('Your favourites have been synced');
            }
          });
        }
      });
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
      this.loadFavourites();
    }
  }

  private loadFromStorage(): void {
    const items = this.getFromStorage();
    this.favouritesSubject.next(items);
  }

  clearAll(): void {
    this.favouritesSubject.next([]);
    this.favouritesLoaded = false;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private getFromStorage(): FavouriteItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private persist(items: FavouriteItem[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
  }
}
