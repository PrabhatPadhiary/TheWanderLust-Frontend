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

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.firebaseAuth = getAuth(this.app);
    this.provider = new GoogleAuthProvider();

    // Restore user from localStorage on app start
    const stored = localStorage.getItem('wanderlust_user');
    if (stored) {
      try {
        this.currentUserSubject.next(JSON.parse(stored));
      } catch {
        localStorage.removeItem('wanderlust_user');
      }
    }

    // Listen for Firebase auth state changes
    onAuthStateChanged(this.firebaseAuth, (firebaseUser) => {
      if (!firebaseUser) {
        // Firebase session expired/logged out
        this.clearSession();
      }
    });
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

  logout(): void {
    signOut(this.firebaseAuth);
    this.clearSession();
  }

  private setSession(user: UserResponse): void {
    localStorage.setItem('wanderlust_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    localStorage.removeItem('wanderlust_user');
    this.currentUserSubject.next(null);
  }
}
