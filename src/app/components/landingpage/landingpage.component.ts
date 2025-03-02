import { Component, ElementRef, OnInit, Renderer2, ViewChild } from '@angular/core';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { UsersService } from '../../services/users/users.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.scss',
  providers: [DatePipe]
})
export class LandingpageComponent implements OnInit {
  @ViewChild('box') boxRef!: ElementRef;
  @ViewChild('leaf') leafRef!: ElementRef;
  @ViewChild('hill1') hill1Ref!: ElementRef;
  @ViewChild('hill4') hill4Ref!: ElementRef;
  @ViewChild('hill5') hill5Ref!: ElementRef;


  isLoginModalOpen = false;


  constructor(
    private renderer: Renderer2,
    private auth: AuthService,
    private router: Router,
    private userService: UsersService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    window.addEventListener('scroll', this.onScroll.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll.bind(this));
  }

  onScroll(): void {
    const value = Math.min(window.scrollY, 500);

    // Use Renderer2 to safely manipulate DOM elements
    if (this.boxRef) {
      this.renderer.setStyle(this.boxRef.nativeElement, 'marginTop', Math.min(value * 2.5, 1200) + 'px');
    }
    if (this.leafRef) {
      this.renderer.setStyle(this.leafRef.nativeElement, 'top', Math.max(value * -1.5, -500) + 'px');
      this.renderer.setStyle(this.leafRef.nativeElement, 'left', Math.min(value * 1.5, 600) + 'px');
    }
    if (this.hill5Ref) {
      this.renderer.setStyle(this.hill5Ref.nativeElement, 'left', Math.min(value * 1.5, 600) + 'px');
    }
    if (this.hill4Ref) {
      this.renderer.setStyle(this.hill4Ref.nativeElement, 'left', Math.max(value * -1.5, -600) + 'px');
    }
    if (this.hill1Ref) {
      this.renderer.setStyle(this.hill1Ref.nativeElement, 'top', Math.min(value * 1, 400) + 'px');
    }
  }

  onWriteBlogClick() {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/blog'])
    }
    else {
      this.isLoginModalOpen = true;
    }
  }

  closeModal() {
    this.isLoginModalOpen = false;
  }

  logout() {
    this.auth.logout();
  }

  redirectBlog() {
    this.router.navigate(['/blog'])
  }
}
