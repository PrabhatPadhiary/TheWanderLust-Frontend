import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

import TokenDecode from '../../helpers/Token/tokenDecoder';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private currentUserSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  private readonly baseUrl: string = `${environment.apiUrl}/User/`

  private http = inject(HttpClient)
  private tokenDecoder = inject(TokenDecode)
  constructor(){
    const user = this.tokenDecoder.decodePayloadFromToken();
    this.currentUserSubject.next(user);
  }

  getTopWriters(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}top-writers`)
  }

  setCurrentUser(user: User | null) {
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  logOutCurrentUser(){
    this.currentUserSubject.next(null);
  }

  getUserDetails(email: string): Observable<any>{
    return this.http.get<any>(`${this.baseUrl}getUserDetails`, {
      params: {email}
    })
  }

}
