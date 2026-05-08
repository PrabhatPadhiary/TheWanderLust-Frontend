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
