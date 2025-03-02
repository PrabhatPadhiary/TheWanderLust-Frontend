import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

export const authGuard: CanActivateFn = (route, state) => {

  const authService = inject(AuthService);
  const routeService = inject(Router);
  const toastrService = inject(ToastrService);

  if(authService.isLoggedIn()){
    return true;
  }else{
    toastrService.warning("Please login first to access Blog section", '', {
      closeButton: true,
      progressBar: true
    });
    routeService.navigate(['login']);
    return false;
  }
};
