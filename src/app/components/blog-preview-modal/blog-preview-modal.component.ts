import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BlogService } from '../../services/blogs/blog.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-blog-preview-modal',
  standalone: false,
  templateUrl: './blog-preview-modal.component.html',
  styleUrl: './blog-preview-modal.component.scss'
})
export class BlogPreviewModalComponent{
  commentForm: FormGroup;
  comments: any[] = [];

  private fb = inject(FormBuilder);
  private toastrService = inject(ToastrService);
  private blogService = inject(BlogService);
  public dialogRef = inject(MatDialogRef<BlogPreviewModalComponent>);
  public data = inject(MAT_DIALOG_DATA);

  constructor() {
    console.log(this.data);
    this.commentForm = this.fb.group({
      commentText: ['', Validators.required]
    });

    this.loadComments();
  }

  loadComments() {
    this.blogService.getComments(this.data.blog.id).subscribe((res: any) => {
      this.comments = res;
    });
  }

  prevSlide(blog: any) {
    if (this.data.blog.currentIndex > 0) {
      this.data.blog.currentIndex--;
    } else {
      this.data.blog.currentIndex = this.data.blog.imagesMetaData.length - 1;
    }
  }

  nextSlide(blog: any) {
    if (this.data.blog.currentIndex < this.data.blog.imagesMetaData.length - 1) {
      this.data.blog.currentIndex++;
    } else {
      this.data.blog.currentIndex = 0; // Loop back to first image
    }
  }

  onSubmit() {
    if (!this.commentForm.valid) return;

    const newComment = {
      blogId: this.data.blog.id,
      content: this.commentForm.value.commentText,
      author: this.data.userDetails.username
    };

    this.blogService.blogComment(newComment).subscribe((res: any) => {
      this.data.blog.latestComment.content = res.comment;
      this.data.blog.latestComment.author = res.author;
      this.data.blog.commentCount += 1;
      this.toastrService.success("Comment Success", "", {
        closeButton: true,
        progressBar: true
      })
      let commentObj = 
      {
        author: res.author,
        content: res.comment
      }
      this.comments.unshift(commentObj);
      console.log("comments:", this.comments);
      this.commentForm.reset();
    });
  }

  closeModal() {
    this.dialogRef.close();
  }
}
