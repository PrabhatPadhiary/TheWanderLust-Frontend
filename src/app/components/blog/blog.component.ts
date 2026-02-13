import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { BlogService } from '../../services/blogs/blog.service';
import { DatePipe } from '@angular/common';
import TokenDecode from '../../helpers/Token/tokenDecoder';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { UsersService } from '../../services/users/users.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BlogPreviewModalComponent } from '../blog-preview-modal/blog-preview-modal.component';
import { SharedService } from '../../services/shared/shared.service';

@Component({
  selector: 'app-blogpost',
  standalone: false,
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.scss'
})
export class BlogComponent implements OnInit {

  blogs: any[] = [];
  user: any;
  currentPage: number = 1;
  totalPages: number = 0;
  pageSize: number = 10;
  loading: boolean = false;
  currentIndex: number = 0;
  commentForm!: FormGroup;
  userDetails: any;
  isModalOpen = false;

  constructor(
    private blogService: BlogService,
    private datePipe: DatePipe,
    private tokenDecoder: TokenDecode,
    private fb: FormBuilder,
    private toastrService: ToastrService,
    private userService: UsersService,
    private dialog: MatDialog,
    private sharedService: SharedService

    
  ) { }

  ngOnInit(): void {
    this.user = this.tokenDecoder.decodePayloadFromToken();
    this.userService.getUserDetails(this.user.email).subscribe(
      (response) => {
        this.userDetails = response;
        this.sharedService.setUserDetails(this.userDetails);
      },
      (error) => {
        this.toastrService.error("Error fetching User Details", "", {
          progressBar: true,
          closeButton: true
        })
      }
    )
    this.loadBlogs();
  }

  prevSlide(blog: any) {
    if (blog.currentIndex > 0) {
      blog.currentIndex--;
    } else {
      blog.currentIndex = blog.imagesMetaData.length - 1; // Loop to last image
    }
  }

  nextSlide(blog: any) {
    if (blog.currentIndex < blog.imagesMetaData.length - 1) {
      blog.currentIndex++;
    } else {
      blog.currentIndex = 0; // Loop back to first image
    }
  }

  loadBlogs(): void {
    if (this.loading || (this.totalPages > 0 && this.currentPage > this.totalPages))
      return;

    this.loading = true;
    this.blogService.getAllBlogs(this.currentPage, this.pageSize).subscribe(
      (response) => {
        response.blogDetails.forEach(blog => {
          blog.createdAtFormatted = this.datePipe.transform(blog.createdAt, 'fullDate');
          blog.isLiked = blog.likes?.some((like: any) => like.userEmail == this.user.email) || false;
          if (blog.currentIndex === undefined || blog.currentIndex === null) {
            blog.currentIndex = 0;
          }
          blog.commentForm = this.fb.group({
            commentText: ['', Validators.required]
          });
          blog.latestComment = blog.latestComment || {};
        });

        this.blogs = this.blogs.concat(response.blogDetails);
        this.totalPages = response.totalPages;
        this.currentPage++;
        this.loading = false;
        this.sharedService.setBlogs(this.blogs);
      },
      (error) => {
        console.error("Error fetching Blogs");
      }
    );
  }

  getShortContent(content: string, wordLimit: number): string {
    let words = content.split(/\s+/); // Split content into words
    return words.length > wordLimit ? words.slice(0, wordLimit).join(' ') + '...' : content;
  }

  isContentLong(content: string): boolean{
    return content.split(/\s+/).length > 100;
  }

  getImageClass(image: any): string {
    return image?.width >= image?.height ? 'landscape' : 'potrait';
  }

  toggleLike(blog: any) {

    var blogLikeDto = {
      BlogId: blog.id,
      UserEmail: this.user?.email
    }
    console.log("bloglikedto", blogLikeDto);
    this.blogService.toggleLike(blogLikeDto).subscribe({
      next: (response: any) => {
        console.log("response", response)
        blog.likeCount = response.likeCount;
        blog.isLiked = !blog.isLiked;
      },
      error: err => console.error("Error toggling like", err)
    });
  }

  trackByBlogId(index: number, blog: any): number {
    return blog.id;
  }

  onScroll(): void {
    this.loadBlogs();
  }

  openCommentModal(blog: any) {
    this.isModalOpen = true;
    const dialogRef = this.dialog.open(BlogPreviewModalComponent, {
      data: {
        blog: blog,
        user: this.user,
        userDetails: this.userDetails
      }
    });
    dialogRef.afterClosed().subscribe(() => {
      this.isModalOpen = false;
    });
  }

  onSubmit(blog: any, commentInput: HTMLTextAreaElement) {
    const commentValue = blog.commentForm.value.commentText;
    if (!commentValue) {
      commentInput.focus();
      return;
    }
    console.log('Submitting comment for blog', blog.id, commentValue);
    var commentDetails = {
      blogId: blog.id,
      content: commentValue,
      author: this.user.username
    }
    this.blogService.blogComment(commentDetails).subscribe({
      next: (response: any) => {
        if(response){
          blog.latestComment.content = response.comment;
          blog.latestComment.author = response.author;
          blog.commentCount += 1;
          this.toastrService.success("Comment Success", "", {
            closeButton: true,
            progressBar: true
          })
        }
      },
      error: err => console.error("Error commenting", err)
    });
    blog.commentForm.reset();
  }
}
