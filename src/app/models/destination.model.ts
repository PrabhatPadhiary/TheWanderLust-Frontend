export interface PlaceCategoriesResponse {
  placeId: string;
  name: string;
  formattedAddress: string;
  geometry: Geometry;
  restaurants: PlaceDto[];
  lodging: PlaceDto[];
  touristAttractions: PlaceDto[];
}

export interface PlaceDto {
  placeId: string;
  name: string;
  vicinity: string;
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  geometry: Geometry;
  photos: PlacePhoto[];
  types: string[];
}

export interface Geometry {
  latitude: number;
  longitude: number;
}

export interface PlacePhoto {
  url: string;
}

export interface PlaceDetailsResponse {
  placeId: string;
  name: string;
  formattedAddress: string;
  formattedPhoneNumber: string;
  website: string;
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  geometry: Geometry;
  photos: PlacePhoto[];
  reviews: PlaceReview[];
  openingHours: OpeningHours | null;
}

export interface PlaceReview {
  authorName: string;
  profilePhotoUrl: string;
  rating: number;
  text: string;
  relativeTimeDescription: string;
}

export interface OpeningHours {
  openNow: boolean | null;
  weekdayText: string[];
}
