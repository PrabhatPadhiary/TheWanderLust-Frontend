import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlaceCategoriesResponse, PlaceDto, PlaceDetailsResponse } from '../models/destination.model';

export interface RegionResult {
  placeId: string;
  name: string;
  secondary?: string;
  types?: string[];
}

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

  getPlacesByCategory(placeId: string, category: 'restaurants' | 'stays' | 'attractions'): Observable<PlaceDto[]> {
    return this.http.get<PlaceDto[]>(`${this.baseUrl}/places`, {
      params: { placeId, category }
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

  /**
   * Cities and regions matching `query`, optionally only within `near`
   * ({ lat, lng, radius in metres }). Results: { placeId, name, secondary, types }.
   */
  searchRegions(query: string, near?: { lat: number; lng: number; radius: number }): Observable<RegionResult[]> {
    const params: Record<string, string> = { query };
    if (near) {
      params['lat'] = String(near.lat);
      params['lng'] = String(near.lng);
      params['radius'] = String(Math.round(near.radius));
    }
    return this.http.get<RegionResult[]>(`${this.baseUrl}/search`, { params });
  }

  /**
   * One page (20, up to 3 pages) of places in a destination: anything typed
   * (`query`: "ramen"), a chip filter ("cafes") or a category
   * (restaurants | stays | attractions). Kept inside the destination by the backend.
   */
  searchInDestination(placeId: string, opts: { query?: string; category?: string; filter?: string; page: number }): Observable<{ places: PlaceDto[]; hasMore: boolean }> {
    const params: Record<string, string> = { placeId, page: String(opts.page) };
    if (opts.query) params['query'] = opts.query;
    else if (opts.filter) params['filter'] = opts.filter;
    else if (opts.category) params['category'] = opts.category;
    return this.http.get<{ places: PlaceDto[]; hasMore: boolean }>(`${this.baseUrl}/places/search`, { params });
  }

  getDetails(placeId: string): Observable<PlaceDetailsResponse> {
    return this.http.get<PlaceDetailsResponse>(`${this.baseUrl}/details`, {
      params: { placeId }
    });
  }
}
