import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { TokenApiModel } from '../../models/token-api.model';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService, 
    private toastrService: ToastrService,
    private routerService: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const myToken = this.authService.getToken();

    if (myToken) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${myToken}`}
      });
    }

    return next.handle(req).pipe(
      catchError((err: any) => {
        if(err instanceof HttpErrorResponse){
          if(err.status === 401){
            return this.handleUnauthorizedError(req, next);
          }
        }
        return throwError(() => err);
      })
    )
  }

  handleUnauthorizedError(req: HttpRequest<any>, next: HttpHandler){
    let tokenApiModel = new TokenApiModel();
    tokenApiModel.accessToken = this.authService.getToken()!;
    tokenApiModel.refreshToken = this.authService.getRefreshToken()!;

    return this.authService.refreshTokens(tokenApiModel)
    .pipe(
      switchMap((data: TokenApiModel) => {
        this.authService.setRefreshToken(data.refreshToken);
        this.authService.setToken(data.accessToken);
        req = req.clone({
          setHeaders: { Authorization: `Bearer ${data.accessToken}`}
        });
        return next.handle(req);
      }),
      catchError((err) => {
        return throwError(() => {
            this.toastrService.warning("Session Timed Out, Please Login Again!","", {
              closeButton: true,
              progressBar: true
            });
            this.authService.logout();
            this.routerService.navigate(['login']);
        })
      })
    )
  }

}
