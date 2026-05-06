import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlaceCategoriesResponse } from '../models/destination.model';

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

  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${(window as any).__GOOGLE_API_KEY || ''}`;
  }
}
