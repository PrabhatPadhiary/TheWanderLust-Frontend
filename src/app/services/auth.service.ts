import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, Auth } from 'firebase/auth';
import { Observable, switchMap } from 'rxjs';
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

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.firebaseAuth = getAuth(this.app);
    this.provider = new GoogleAuthProvider();
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
}
