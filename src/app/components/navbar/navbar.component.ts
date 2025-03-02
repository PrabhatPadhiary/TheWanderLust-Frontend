import { Component, OnInit } from '@angular/core';
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

  constructor(
    private auth: AuthService,
    private router: Router,
    private toaster: ToastrService,
    private userService: UsersService
  ) {}
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
