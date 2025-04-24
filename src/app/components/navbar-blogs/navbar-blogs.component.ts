import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { BlogService } from '../../services/blogs/blog.service';
import { SharedService } from '../../services/shared/shared.service';
import { BlogPreviewModalComponent } from '../blog-preview-modal/blog-preview-modal.component';
import TokenDecode from '../../helpers/Token/tokenDecoder';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-navbar-blogs',
  standalone: false,
  templateUrl: './navbar-blogs.component.html',
  styleUrl: './navbar-blogs.component.scss'
})
export class NavbarBlogsComponent implements OnInit{

  searchControl = new FormControl();
  searchQuery: string = '';
  searchResults: any[] = [];
  dropdownOpen = false;
  blogs: any[] = [];
  userDetails: any;
  baseUrl: string = "http://localhost:5273";
  user: any;
  isModalOpen = false;
  selectedBlog: any;

  constructor(
    private blogService: BlogService,
    private sharedService: SharedService,
    private dialog: MatDialog,
    private tokenDecoder: TokenDecode,
  ){}

  ngOnInit(): void {
    this.sharedService.blogs$.subscribe(blogs => {
      this.blogs = blogs;
      console.log("Received blogs", this.blogs);
    })

    this.sharedService.userData$.subscribe(userData => {
      this.userDetails = userData;
      console.log("received user details", this.userDetails);
    })

    this.searchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(query => this.blogService.searchBlogs(query))
    ).subscribe(response => {
      this.searchResults = [
        ...response.blogs.map(b => ({ ...b, type: 'blog' })), 
        ...response.users.map(u => ({ ...u, type: 'user' }))
      ];
      this.updateImagePaths();
    });
  }

  updateImagePaths(){
    this.searchResults = this.searchResults.map(item => ({
      ...item,
      ...(item.type === "blog" && { image: this.baseUrl + item.image }),
      ...(item.type === "user" && { profilePic: this.baseUrl + item.profilePic })
    }));
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  onSearch() {
    this.searchControl.setValue(this.searchQuery);
  }

  search() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
  
    this.blogService.searchBlogs(this.searchQuery).subscribe(response => {
      this.searchResults = [
        ...response.blogs.map(b => ({ ...b, type: 'blog' })), 
        ...response.users.map(u => ({ ...u, type: 'user' }))
      ];
    });

    this.updateImagePaths();
  }

    openCommentModal(blog: any) {
      this.user = this.tokenDecoder.decodePayloadFromToken();
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

  selectItem(item: any) {
    if (item.id) {
      const existingBlog = this.blogs.find(blog => blog.id === item.id);
      if(existingBlog){
        this.openCommentModal(existingBlog);
      }
      else
      {
        this.blogService.getBlogById(item.id).subscribe((resp) => {
          this.selectedBlog = resp;

          this.selectedBlog.imageUrls = this.selectedBlog.imageUrls.map((url: string) => this.baseUrl + url);

          this.openCommentModal(resp);
        })
      }
    } 
    else if (item.username) {
      window.location.href = `/profile/${item.username}`;
    }
  }

  openBlogModal(blog: any) {
    // Logic to open modal (if using Angular Material, MatDialog)
    console.log('Opening blog modal for:', blog);
  }  
}
