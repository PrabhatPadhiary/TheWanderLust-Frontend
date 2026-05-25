import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, Auth, onAuthStateChanged } from 'firebase/auth';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserResponse {
  id: string;
  firebaseId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: UserResponse;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private app: FirebaseApp;
  private firebaseAuth: Auth;
  private provider: GoogleAuthProvider;
  private http = inject(HttpClient);

  private currentUserSubject = new BehaviorSubject<UserResponse | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Resolves once Firebase has restored auth state on startup
  public authReady: Promise<void>;
  private resolveAuthReady!: () => void;

  // Injected lazily to avoid circular dependency
  private onLogoutCallback: (() => void) | null = null;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.firebaseAuth = getAuth(this.app);
    this.provider = new GoogleAuthProvider();

    this.authReady = new Promise(resolve => { this.resolveAuthReady = resolve; });

    const stored = localStorage.getItem('wanderlust_user');
    if (stored) {
      try {
        this.currentUserSubject.next(JSON.parse(stored));
      } catch {
        localStorage.removeItem('wanderlust_user');
      }
    }

    onAuthStateChanged(this.firebaseAuth, (firebaseUser) => {
      if (!firebaseUser) {
        this.clearSession();
      }
      // Resolve once — Firebase calls this immediately on init with the restored user (or null)
      this.resolveAuthReady();
    });
  }

  registerLogoutCallback(cb: () => void): void {
    this.onLogoutCallback = cb;
  }

  get currentUser(): UserResponse | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  async getFirebaseToken(): Promise<string | null> {
    const user = this.firebaseAuth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  loginWithGoogle(): Observable<LoginResult> {
    return new Observable(observer => {
      signInWithPopup(this.firebaseAuth, this.provider)
        .then(result => result.user.getIdToken())
        .then(token => {
          this.http.post<UserResponse>(
            `${environment.apiUrl}/Auth/login`,
            { token }
          ).subscribe({
            next: (user) => {
              this.setSession(user);
              observer.next({ success: true, user });
              observer.complete();
            },
            error: (err) => {
              const message = err?.error || err?.message || 'Login failed';
              observer.next({ success: false, error: message });
              observer.complete();
            }
          });
        })
        .catch(error => {
          let errorMessage = 'Google login failed';
          if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Login cancelled';
          } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Popup was blocked. Please allow popups and try again.';
          }
          observer.next({ success: false, error: errorMessage });
          observer.complete();
        });
    });
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.firebaseAuth);
    } finally {
      this.clearSession();
    }
  }

  private setSession(user: UserResponse): void {
    localStorage.setItem('wanderlust_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    localStorage.removeItem('wanderlust_user');
    this.currentUserSubject.next(null);
    this.onLogoutCallback?.();
  }
}
