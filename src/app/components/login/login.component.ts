import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import ValidateForm from '../../helpers/Validators/fromvaidation';
import { AuthService, User } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UsersService } from '../../services/users/users.service';
import TokenDecode from '../../helpers/Token/tokenDecoder';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {

  @Output() loginSuccess = new EventEmitter<void>();
  type: string = "password";
  passClass: string = "fa fa-eye-slash";
  loginForm!: FormGroup;

  private fb = inject(FormBuilder)
  private auth = inject(AuthService)
  private router = inject(Router)
  private toastr = inject(ToastrService)
  private userService = inject(UsersService)
  private tokenDecoder = inject(TokenDecode)

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    })
  }

  hideShowPass() {
    if (this.type == "password") {
      this.type = "text"
      this.passClass = "fa-eye"
    }
    else {
      this.type = "password"
      this.passClass = "fa-eye-slash"
    }
  }

  onLogin() {
    if (this.loginForm.valid) {
      this.auth.login(this.loginForm.value)
        .subscribe({
          next: (res) => {
            this.auth.setToken(res.accessToken);
            this.auth.setRefreshToken(res.refreshToken);
            const user = this.tokenDecoder.decodePayloadFromToken()
            this.userService.setCurrentUser(user);
            
            this.loginForm.reset();
            this.toastr.success("Login Successful", '', {
              closeButton: true,
              progressBar: true,
            }); 
            this.router.navigate(['home']);
            this.loginSuccess.emit();
          },
          error: (err => {
            console.log(err);
            this.toastr.error(err?.error, '', {
              closeButton: true,
              progressBar: true,
            });
          })
        });
    }
    else {
      ValidateForm.validateAllFormFields(this.loginForm);
      this.toastr.error("Please fill all the details", "", {
        closeButton: true,
        progressBar: true
      });
    }
  }
}