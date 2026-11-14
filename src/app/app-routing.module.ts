import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageV2Component } from './components/landing-page-v2/landing-page-v2.component';
import { DestinationComponent } from './components/destination/destination.component';
import { TripPlannerComponent } from './components/trip-planner/trip-planner.component';
import { FavouritesComponent } from './components/favourites/favourites.component';
import { JoinTripComponent } from './components/join-trip/join-trip.component';
import { MyTripsComponent } from './components/my-trips/my-trips.component';
import { CommunityComponent } from './components/community/community.component';
import { WriteJournalComponent } from './components/community/write-journal/write-journal.component';
import { JournalDetailComponent } from './components/community/journal-detail/journal-detail.component';
import { FeaturesComponent } from './components/features/features.component';
import { PricingComponent } from './components/pricing/pricing.component';
import { MyJournalsComponent } from './components/my-journals/my-journals.component';
import { LegalComponent } from './components/legal/legal.component';
import { DownloadComponent } from './components/download/download.component';
import { ProfileComponent } from './components/profile/profile.component';
import { SettingsComponent } from './components/settings/settings.component';

const routes: Routes = [
  { path: '', component: LandingPageV2Component },
  { path: 'home', component: LandingPageV2Component },
  { path: 'v2', component: LandingPageV2Component },
  { path: 'destination/:placeId', component: DestinationComponent },
  { path: 'trip-planner', component: TripPlannerComponent },
  { path: 'trip-planner/:tripId', component: TripPlannerComponent },
  { path: 'join/:tripId', component: JoinTripComponent },
  { path: 'favourites', component: FavouritesComponent },
  { path: 'my-trips', component: MyTripsComponent },
  { path: 'community', component: CommunityComponent },
  { path: 'community/write', component: WriteJournalComponent },
  { path: 'community/journal/:id', component: JournalDetailComponent },
  { path: 'my-journals', component: MyJournalsComponent },
  { path: 'features', component: FeaturesComponent },
  { path: 'pricing', component: PricingComponent },
  // Linked from the mobile app and from Google's sign-in consent screen.
  { path: 'privacy', component: LegalComponent, data: { doc: 'privacy' }, title: 'Privacy Policy · Wayraa' },
  { path: 'terms', component: LegalComponent, data: { doc: 'terms' }, title: 'Terms of Use · Wayraa' },
  { path: 'download', component: DownloadComponent, title: 'Get Wayraa for Android (Beta)' },
  { path: 'profile', component: ProfileComponent, title: 'Your profile · Wayraa' },
  { path: 'settings', component: SettingsComponent, title: 'Settings · Wayraa' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
