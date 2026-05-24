import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { DestinationComponent } from './components/destination/destination.component';
import { TripPlannerComponent } from './components/trip-planner/trip-planner.component';
import { FavouritesComponent } from './components/favourites/favourites.component';

const routes: Routes = [
  { path: '', component: LandingpageComponent },
  { path: 'home', component: LandingpageComponent },
  { path: 'destination/:placeId', component: DestinationComponent },
  { path: 'trip-planner', component: TripPlannerComponent },
  { path: 'favourites', component: FavouritesComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
