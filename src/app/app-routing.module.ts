import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { DestinationComponent } from './components/destination/destination.component';
import { TripPlannerComponent } from './components/trip-planner/trip-planner.component';
import { FavouritesComponent } from './components/favourites/favourites.component';

import { MyTripsComponent } from './components/my-trips/my-trips.component';

const routes: Routes = [
  { path: '', component: LandingpageComponent },
  { path: 'home', component: LandingpageComponent },
  { path: 'destination/:placeId', component: DestinationComponent },
  { path: 'trip-planner', component: TripPlannerComponent },
  { path: 'trip-planner/:tripId', component: TripPlannerComponent },
  { path: 'favourites', component: FavouritesComponent },
  { path: 'my-trips', component: MyTripsComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
