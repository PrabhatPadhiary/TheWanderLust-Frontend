import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BlogService } from '../../services/blogs/blog.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import TokenDecode from '../../helpers/Token/tokenDecoder';
import { SharedService } from '../../services/shared/shared.service';

interface ImageData {
  file: File;
  preview: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-blog-post-modal',
  standalone: false,
  templateUrl: './blog-post-modal.component.html',
  styleUrl: './blog-post-modal.component.scss'
})
export class BlogPostModalComponent implements OnInit {

  blogForm!: FormGroup
  imagePreviews: string[] = [];
  uploadedImages: ImageData[] = [];
  uploadedFileNames: Set<string> = new Set();
  isVisible = false;
  isUploading = false;
  progress = 0;

  @ViewChild('fileInput') fileInput!: ElementRef;
  private fb = inject(FormBuilder);
  private blogService = inject(BlogService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private tokenDecoder = inject(TokenDecode);
  private sharedService = inject(SharedService);

  ngOnInit(): void {
    this.blogForm = this.fb.group({
      heading: ['', Validators.required],
      content: ['', Validators.required],
      location: ['', Validators.required],
      tagline: ['', Validators.required],
      image: [[]]
    });
  }

  open() {
    this.isVisible = true;
    document.body.classList.add("no-scroll");
  }

  close() {
    this.isVisible = false;
    document.body.classList.remove("no-scroll");
  }

  extractImageData(file: File): Promise<{ file: File; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader;
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          resolve({
            file,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        img.onerror = reject;
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  onFileChange(event: any) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files) as File[];
    fileArray.forEach((file: File) => {
      if (!file.type || !file.type.startsWith('image/')) {
        this.toastr.error("Only image files are allowed", "", {
          closeButton: true,
          progressBar: true
        });
        return;
      }
      if (this.uploadedFileNames.has(file.name)) {
        this.toastr.error(`${file.name} has already been uploaded`, "", {
          closeButton: true,
          progressBar: true
        });
        return;
      }

      this.uploadedFileNames.add(file.name);
      this.extractImageData(file).then(imageData => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          this.imagePreviews.push(preview);
          this.uploadedImages.push({
            file,
            preview,
            width: imageData.width,
            height: imageData.height
          });
          this.blogForm.patchValue({ image: this.uploadedImages });
        };
        reader.readAsDataURL(file);
      }).catch((err) => {
        console.error('Error extracting image data', err);
      });
    });

    event.target.value = '';
  }

  removeImage(index: number) {
    const removedFileName = this.uploadedImages[index].file.name;

    this.imagePreviews.splice(index, 1); // Remove preview
    this.uploadedImages.splice(index, 1); // Remove file
    this.uploadedFileNames.delete(removedFileName)
    this.blogForm.patchValue({ images: this.uploadedImages });
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click(); // Open file dialog manually
  }

  onSubmit() {

    if (this.isUploading) return;

    if (this.blogForm.invalid) {
      this.toastr.warning("Validation Error", "Validation", {
        closeButton: true,
        progressBar: true,
      });
      return;
    }

    this.isUploading = true;
    this.progress = 0;

    let interval = setInterval(() => {
      if (this.progress < 90) {
        this.progress += 10;
      }
    }, 300);

    const formdata = new FormData();
    formdata.append('Heading', this.blogForm.value.heading);
    formdata.append('Tagline', this.blogForm.value.tagline);
    formdata.append('Content', this.blogForm.value.content);
    formdata.append('Location', this.blogForm.value.location);

    const user = this.tokenDecoder.decodePayloadFromToken();
    if (user?.email) {
      formdata.append('UserEmail', user.email);
    }

    this.uploadedImages.forEach((imageData) => {
      formdata.append('Images', imageData.file);
      formdata.append('ImageWidths', imageData.width.toString());
      formdata.append('ImageHeights', imageData.height.toString());
    });

    this.blogService.postBlog(formdata).subscribe(
      () => {
        clearInterval(interval);
        this.progress = 100;

        setTimeout(() => {
          this.isUploading = false;
          this.toastr.success('Blog posted successfully!', 'Success', {
            closeButton: true,
            progressBar: true,
          });
          this.close();
        }, 500);
      },
      () => {
        clearInterval(interval);
        this.isUploading = false;
        this.toastr.error('Error Posting Blog!', 'Error', {
          closeButton: true,
          progressBar: true,
        });
      }
    );
  }
}
