import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlaceCategoriesResponse, PlaceDto } from '../models/destination.model';

@Injectable({
  providedIn: 'root'
})
export class DestinationService {

  private baseUrl = `${environment.apiUrl}/Destinations`;

  constructor(private http: HttpClient) {}

  search(placeId: string): Observable<PlaceCategoriesResponse> {
    return this.http.get<PlaceCategoriesResponse>(`${this.baseUrl}/search`, {
      params: { placeId }
    });
  }

  getHeroImage(placeId: string): Observable<{ imageUrls: string[] }> {
    return this.http.get<{ imageUrls: string[] }>(`${this.baseUrl}/hero-image`, {
      params: { placeId }
    });
  }

  filter(placeId: string, filterName: string): Observable<PlaceDto[]> {
    return this.http.get<PlaceDto[]>(`${this.baseUrl}/filter`, {
      params: { placeId, filter: filterName }
    });
  }
}
