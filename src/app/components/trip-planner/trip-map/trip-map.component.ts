import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { TripPlaceDetailResponse } from '../../../services/trip.service';

declare var google: any;

@Component({
  selector: 'app-trip-map',
  templateUrl: './trip-map.component.html',
  styleUrls: ['./trip-map.component.scss'],
  standalone: false
})
export class TripMapComponent implements AfterViewInit, OnChanges {
  @Input() places: TripPlaceDetailResponse[] = [];
  @Input() destinationLat: number | null = null;
  @Input() destinationLng: number | null = null;
  @Input() activeTab: string = 'stays';
  @Input() highlightedPlaceId: string | null = null;

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private map: any = null;
  private markers: any[] = [];
  private markerMap: Map<string, any> = new Map();
  private mapReady = false;
  private activeInfoWindow: any = null;

  get placesWithCoords(): TripPlaceDetailResponse[] {
    return this.places.filter(p => p.latitude && p.longitude);
  }

  ngAfterViewInit(): void {
    this.waitForGoogleMaps();
  }

  private lastPlaceIds: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapReady) return;
    const currentIds = this.placesWithCoords.map(p => p.id).join(',');
    if (currentIds !== this.lastPlaceIds) {
      this.lastPlaceIds = currentIds;
      this.updateMarkers();
    }
    if (changes['highlightedPlaceId']) {
      this.highlightMarker(this.highlightedPlaceId);
    }
  }

  private waitForGoogleMaps(): void {
    if (typeof google !== 'undefined' && google.maps) {
      setTimeout(() => this.initMap(), 100);
    } else {
      // Retry every 200ms until Google Maps loads
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(interval);
          this.initMap();
        }
      }, 200);
    }
  }

  private initMap(): void {
    if (typeof google === 'undefined' || !google.maps) return;

    const center = this.getCenter();
    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    });

    // Force resize after paint so tiles render correctly
    setTimeout(() => {
      google.maps.event.trigger(this.map, 'resize');
      this.map.setCenter(this.getCenter());
      this.mapReady = true;
      this.updateMarkers();
    }, 200);

    // Close info window when clicking on the map background
    this.map.addListener('click', () => {
      if (this.activeInfoWindow) {
        this.activeInfoWindow.close();
        this.activeInfoWindow = null;
      }
    });
  }

  private getCenter(): { lat: number; lng: number } {
    if (this.placesWithCoords.length > 0) {
      const avgLat = this.placesWithCoords.reduce((sum, p) => sum + (p.latitude || 0), 0) / this.placesWithCoords.length;
      const avgLng = this.placesWithCoords.reduce((sum, p) => sum + (p.longitude || 0), 0) / this.placesWithCoords.length;
      return { lat: avgLat, lng: avgLng };
    }
    if (this.destinationLat && this.destinationLng) {
      return { lat: this.destinationLat, lng: this.destinationLng };
    }
    return { lat: 48.8566, lng: 2.3522 }; // Default: Paris
  }

  private getCategoryColor(category: string): string {
    if (category === 'stay') return '#2563eb';
    if (category === 'food') return '#dc2626';
    return '#16a34a';
  }

  private updateMarkers(): void {
    // Clear old markers
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    this.markerMap.clear();

    if (!this.map || this.placesWithCoords.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    this.placesWithCoords.forEach(place => {
      const position = { lat: place.latitude!, lng: place.longitude! };
      const color = this.getCategoryColor(place.category);

      const marker = new google.maps.Marker({
        position,
        map: this.map,
        title: place.placeName,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="${color}"/><circle cx="12" cy="12" r="5" fill="white"/></svg>`)}`,
          scaledSize: new google.maps.Size(28, 36),
          anchor: new google.maps.Point(14, 36)
        }
      });

      // Info window on click
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-family:Poppins,sans-serif;padding:4px 0;margin:0;line-height:1.3"><div style="font-size:12px;font-weight:600;color:#1a1a1a;margin:0">${place.placeName}</div><div style="font-size:11px;color:#888;margin-top:2px">${place.vicinity || ''}</div></div>`,
        disableAutoPan: true
      });

      marker.addListener('click', () => {
        // Close any previously open info window
        if (this.activeInfoWindow) {
          this.activeInfoWindow.close();
        }
        infoWindow.open(this.map, marker);
        this.activeInfoWindow = infoWindow;
      });

      this.markers.push(marker);
      this.markerMap.set(place.placeId, marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (this.markers.length > 1) {
      this.map.fitBounds(bounds, { padding: 50 });
      // Prevent zooming in too much
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        if (this.map.getZoom() > 15) this.map.setZoom(15);
      });
    } else if (this.markers.length === 1) {
      this.map.setCenter(this.markers[0].getPosition());
      this.map.setZoom(13);
    }

    // Apply highlight if already set
    if (this.highlightedPlaceId) {
      this.highlightMarker(this.highlightedPlaceId);
    }
  }

  private highlightMarker(placeId: string | null): void {
    if (!this.mapReady) return;

    // Reset all markers to normal size
    this.markerMap.forEach((marker, id) => {
      const place = this.placesWithCoords.find(p => p.placeId === id);
      const color = place ? this.getCategoryColor(place.category) : '#2563eb';
      marker.setIcon({
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="${color}"/><circle cx="12" cy="12" r="5" fill="white"/></svg>`)}`,
        scaledSize: new google.maps.Size(28, 36),
        anchor: new google.maps.Point(14, 36)
      });
      marker.setZIndex(1);
    });

    // Highlight the selected one with a distinct orange/amber color
    if (placeId && this.markerMap.has(placeId)) {
      const marker = this.markerMap.get(placeId)!;
      const highlightColor = '#f59e0b';

      marker.setIcon({
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><circle cx="18" cy="18" r="17" fill="${highlightColor}" opacity="0.25"/><path d="M18 2C9.2 2 2 9.2 2 18c0 12 16 28 16 28s16-16 16-28C34 9.2 26.8 2 18 2z" fill="${highlightColor}" stroke="white" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="white"/></svg>`)}`,
        scaledSize: new google.maps.Size(42, 52),
        anchor: new google.maps.Point(21, 52)
      });
      marker.setZIndex(999);
    }
  }
}
