export interface PlaceCategoriesResponse {
  placeId: string;
  name: string;
  formattedAddress: string;
  geometry: Geometry;
  restaurants: NearbyPlace[];
  lodging: NearbyPlace[];
  touristAttractions: NearbyPlace[];
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  vicinity: string;
  rating: number | null;
  geometry: Geometry;
  photos: PlacePhoto[];
  types: string[];
}

export interface Geometry {
  latitude: number;
  longitude: number;
}

export interface PlacePhoto {
  photoReference: string;
  width: number;
  height: number;
}
