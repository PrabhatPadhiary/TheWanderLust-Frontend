import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DestinationComponent } from './components/destination/destination.component';
import { PlaceDetailPanelComponent } from './components/place-detail-panel/place-detail-panel.component';
import { AuthGateModalComponent } from './components/auth-gate-modal/auth-gate-modal.component';
import { TripPlannerComponent } from './components/trip-planner/trip-planner.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FavouritesComponent } from './components/favourites/favourites.component';
import { SafePipe } from './pipes/safe.pipe';

@NgModule({
  declarations: [
    AppComponent,
    LandingpageComponent,
    DestinationComponent,
    PlaceDetailPanelComponent,
    AuthGateModalComponent,
    TripPlannerComponent,
    NavbarComponent,
    FavouritesComponent,
    SafePipe,
  ],
  imports: [
    FormsModule,
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatTooltipModule,
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true
    }),
    BrowserAnimationsModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule
  ],
  providers: [
    provideAnimationsAsync(),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
