import { Component, inject, OnInit } from '@angular/core';
import { AuthService, User } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UsersService } from '../../services/users/users.service';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit{

  currentUser: User|null = null;

    private auth = inject(AuthService);
    private router = inject(Router);
    private toaster = inject(ToastrService);
    private userService = inject(UsersService);
    
  ngOnInit(): void {
    
    this.userService.currentUser$.subscribe(user => {
      this.currentUser = user
    });

  }

  logout() {
    this.auth.logout();
    this.toaster.success("Logged Out Successfuly", "Success", {
      progressBar: true,
      closeButton: true,
    })
  }
}
