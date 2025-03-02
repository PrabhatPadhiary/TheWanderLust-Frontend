import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private baseUrl: string = "http://localhost:5273/api/Blog/"
  constructor(private http: HttpClient) { }

  postBlog(blogData: FormData){
    return this.http.post(`${this.baseUrl}postblog`,blogData)
  }

  getFeaturedBlogs(): Observable<any[]>{
    return this.http.get<any[]>(`${this.baseUrl}getFeaturedBlogs`)
  }

  getAllBlogs(page: number, pageSize: number = 10): Observable<{
    blogDetails: any[],
    currentPage: number,
    pageSize: number,
    totalPages: number,
    totalBlogs: number
  }> {
    return this.http.get<{
      blogDetails: any[],
      currentPage: number,
      pageSize: number,
      totalPages: number,
      totalBlogs: number
    }>(`${this.baseUrl}getallblogs?page=${page}&pageSize=${pageSize}`);
  }

  toggleLike(likeDto: any){
    return this.http.post<any>(`${this.baseUrl}toggleLike`, likeDto);
  }

  blogComment(commentData: any){
    return this.http.post(`${this.baseUrl}blogComment`, commentData)
  }

  getComments(blogId: number): Observable<any>{
    return this.http.get<any>(`${this.baseUrl}getComments`, {
      params: {blogId}
    })
  }

  searchBlogs(query: string): Observable<{blogs: any[], users: any[]}> {
    if (!query.trim()) return new Observable(observer => observer.next({ blogs: [], users: [] })); // Avoid empty searches
    return this.http.get<{ blogs: any[], users: any[] }>(`${this.baseUrl}search`, {
      params: {query}
    });
  }
}
