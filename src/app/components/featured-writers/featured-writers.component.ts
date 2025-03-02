import { Component, OnInit } from '@angular/core';
import { UsersService } from '../../services/users/users.service';

@Component({
  selector: 'app-featured-writers',
  standalone: false,
  templateUrl: './featured-writers.component.html',
  styleUrl: './featured-writers.component.scss'
})
export class FeaturedWritersComponent implements OnInit{
  
  featuredWriters: any[] = [];
  baseUrl: string = "http://localhost:5273";

  constructor(
    private userService: UsersService
  ){

  }
  ngOnInit(): void {
    this.fetchFeaturedWriters();
  }

  fetchFeaturedWriters() {
    this.userService.getTopWriters().subscribe(
      (data) => {
        this.featuredWriters = data;
        this.featuredWriters.forEach(featuredWriter => {
            featuredWriter.profilePicUrl = this.baseUrl + featuredWriter.profilePicUrl
        })
      },
      (error) => {
        console.error("Error fetching Blogs");
      }
    );
  }
}
