import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  constructor() { }

  private blogDataSource = new BehaviorSubject<any[]>([]);
  blogs$ = this.blogDataSource.asObservable();

  private userDataSource = new BehaviorSubject<any[]>([]);
  userData$ = this.userDataSource.asObservable();


  setBlogs(blogs: any[]) {
    this.blogDataSource.next(blogs);
  }

  setUserDetails(userDetails: any[]) {
    this.userDataSource.next(userDetails);
  }
}
