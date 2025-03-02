import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UsersService } from '../users/users.service';
import { TokenApiModel } from '../../models/token-api.model';
import { Router } from '@angular/router';

export interface User{
  firstname: string,
  lastname: string,
  email: string,
  username: string
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl: string = "http://localhost:5273/api/User/"
  
  constructor(
    private http : HttpClient,
    private userService: UsersService,
    private router: Router
  ) { }

  setToken(tokenValue: string){
    localStorage.setItem('token', tokenValue);
  }

  getToken(){
    return localStorage.getItem('token')
  }

  setRefreshToken(tokenValue: string){
    localStorage.setItem('refreshToken', tokenValue);
  }

  getRefreshToken(){
    return localStorage.getItem('refreshToken');
  }

  signUp(signupObj: any){
    return this.http.post<any>(`${this.baseUrl}signup`, signupObj);
  }

  login(loginObj: any){
    return this.http.post<any>(`${this.baseUrl}login`, loginObj);
  }

  refreshTokens(tokenApiModel: TokenApiModel){
    return this.http.post<any>(`${this.baseUrl}refreshTokens`, tokenApiModel);
  }

  logout() {
    localStorage.clear();
    this.userService.logOutCurrentUser();
    this.router.navigate(['login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

}
