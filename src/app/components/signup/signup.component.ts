import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import ValidateForm from '../../helpers/Validators/fromvaidation';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent implements OnInit {

  type: string = "password";
  passClass: string = "fa fa-eye-slash"
  signupForm!: FormGroup;
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null;
  isSubmitting = false;

  private fb = inject(FormBuilder)
  private auth = inject(AuthService)
  private router = inject(Router)
  private toastr = inject(ToastrService)
  
  ngOnInit(): void {
    this.signupForm = this.fb.group({
      firstname: ['', [Validators.required, ValidateForm.noSpaceValidator]],
      lastname: ['', [Validators.required, ValidateForm.noSpaceValidator]],
      email: ['', [Validators.required, Validators.email]],
      username: ['', Validators.required],
      password: ['', Validators.required]
    })
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];

    if (file) {
      this.selectedFile = file;

      // Preview the selected image
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  triggerFileInput() {
    const fileInput = document.getElementById('profileInput') as HTMLInputElement;
    fileInput.click();
  }

  onSignup() {

    if (this.isSubmitting) return;

    if (this.signupForm.invalid) {
      ValidateForm.validateAllFormFields(this.signupForm);
      this.toastr.error("Please fill all the details", "", {
        closeButton: true,
        progressBar: true
      });
      return;
    }

    this.isSubmitting = true;

    const formData = new FormData();
    formData.append('firstname', this.signupForm.value.firstname);
    formData.append('lastname', this.signupForm.value.lastname);
    formData.append('email', this.signupForm.value.email);
    formData.append('username', this.signupForm.value.username);
    formData.append('password', this.signupForm.value.password);

    if (this.selectedFile) {
      formData.append('profilePicture', this.selectedFile);
    }

    this.auth.signUp(formData).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.toastr.success(res.message);
        this.signupForm.reset();
        this.router.navigate(['login']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastr.error(err?.error?.message ?? "Unexpected error");
      }
    });
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
}
