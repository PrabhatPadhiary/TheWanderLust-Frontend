import { Component, inject, OnInit } from '@angular/core';
import { UsersService } from '../../services/users/users.service';

@Component({
  selector: 'app-featured-writers',
  standalone: false,
  templateUrl: './featured-writers.component.html',
  styleUrl: './featured-writers.component.scss'
})
export class FeaturedWritersComponent implements OnInit{
  
  featuredWriters: any[] = [];
  private userService = inject(UsersService)
  
  ngOnInit(): void {
    this.fetchFeaturedWriters();
  }

  fetchFeaturedWriters() {
    this.userService.getTopWriters().subscribe(
      (data) => {
        this.featuredWriters = data;
      },
      (error) => {
        console.error("Error fetching Blogs");
      }
    );
  }
}
