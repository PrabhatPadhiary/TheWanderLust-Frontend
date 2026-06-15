import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageV2Component } from './components/landing-page-v2/landing-page-v2.component';
import { DestinationComponent } from './components/destination/destination.component';
import { TripPlannerComponent } from './components/trip-planner/trip-planner.component';
import { FavouritesComponent } from './components/favourites/favourites.component';
import { JoinTripComponent } from './components/join-trip/join-trip.component';
import { MyTripsComponent } from './components/my-trips/my-trips.component';
import { CommunityComponent } from './components/community/community.component';
import { FeaturesComponent } from './components/features/features.component';
import { PricingComponent } from './components/pricing/pricing.component';

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
  { path: 'features', component: FeaturesComponent },
  { path: 'pricing', component: PricingComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
