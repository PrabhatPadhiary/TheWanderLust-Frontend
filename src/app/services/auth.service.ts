import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, signInWithPopup, signOut, GoogleAuthProvider, Auth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail,
} from 'firebase/auth';
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
  photoUrl?: string | null;
}

/** Firebase error codes -> messages people can act on. */
const EMAIL_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};

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

  /** Sign in with email and password (accounts made on the app or here). */
  loginWithEmail(email: string, password: string): Observable<LoginResult> {
    return this.fromFirebase(
      signInWithEmailAndPassword(this.firebaseAuth, email.trim(), password).then(r => r.user.getIdToken()),
      'Sign-in failed',
    );
  }

  /** Create an account with email and password, then sign in. */
  signUpWithEmail(name: string, email: string, password: string): Observable<LoginResult> {
    return this.fromFirebase(
      createUserWithEmailAndPassword(this.firebaseAuth, email.trim(), password).then(async r => {
        if (name.trim()) await updateProfile(r.user, { displayName: name.trim() });
        return r.user.getIdToken(true); // fresh token, with the name
      }),
      'Could not create your account',
    );
  }

  /** Email a password-reset link. */
  async sendPasswordReset(email?: string): Promise<string> {
    const to = (email || this.firebaseAuth.currentUser?.email || '').trim();
    if (!to) throw new Error('Enter your email address first.');
    try {
      await sendPasswordResetEmail(this.firebaseAuth, to);
      return to;
    } catch (e: any) {
      throw new Error(EMAIL_ERRORS[e?.code] || 'Could not send the link. Please try again.');
    }
  }

  /** How the signed-in user signs in: Google, email and password, or both. */
  signInMethods(): { google: boolean; password: boolean } {
    const providers = (this.firebaseAuth.currentUser?.providerData || []).map(p => p.providerId);
    return { google: providers.includes('google.com'), password: providers.includes('password') };
  }

  /** Keep the stored user in step after a profile change (name, photo). */
  updateStoredUser(changes: Partial<UserResponse>): void {
    const user = this.currentUserSubject.value;
    if (user) this.setSession({ ...user, ...changes });
  }

  /** After the account is deleted on the server: sign out here too. */
  async clearAfterDelete(): Promise<void> {
    try { await signOut(this.firebaseAuth); } catch { /* already gone */ }
    this.clearSession();
  }

  /** A Firebase sign-in (that resolves to an ID token), then the backend login. */
  private fromFirebase(tokenPromise: Promise<string>, fallback: string): Observable<LoginResult> {
    return new Observable(observer => {
      tokenPromise
        .then(token => {
          this.http.post<UserResponse>(`${environment.apiUrl}/Auth/login`, { token }).subscribe({
            next: (user) => {
              this.setSession(user);
              observer.next({ success: true, user });
              observer.complete();
            },
            error: (err) => {
              observer.next({ success: false, error: err?.error || err?.message || fallback });
              observer.complete();
            },
          });
        })
        .catch(error => {
          observer.next({ success: false, error: EMAIL_ERRORS[error?.code] || fallback });
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
