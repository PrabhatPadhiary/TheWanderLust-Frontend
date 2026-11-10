import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

/**
 * Load the Google Maps JavaScript API (with Places) using the website key
 * from the environment, then start the app. Components use `google.maps`
 * straight away, so the app waits for the script; if it fails to load the app
 * still starts (the maps / place search just won't work).
 */
function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    const key = environment.googleMapsApiKey;
    if (!key || key.startsWith('PASTE_')) {
      console.warn('Google Maps key is not set (environment.googleMapsApiKey).');
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => {
      console.error('Could not load Google Maps.');
      resolve();
    };
    document.body.appendChild(script);
  });
}

loadGoogleMaps().then(() =>
  platformBrowserDynamic()
    .bootstrapModule(AppModule, { ngZoneEventCoalescing: true })
    .catch((err) => console.error(err))
);
