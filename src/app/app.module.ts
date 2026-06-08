import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

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
import { AddPlaceModalComponent } from './components/trip-planner/modals/add-place-modal/add-place-modal.component';
import { AddDestinationDialogComponent } from './components/trip-planner/modals/add-destination-dialog/add-destination-dialog.component';
import { DeleteTripConfirmComponent } from './components/trip-planner/modals/delete-trip-confirm/delete-trip-confirm.component';
import { DeleteDestinationConfirmComponent } from './components/trip-planner/modals/delete-destination-confirm/delete-destination-confirm.component';
import { InviteModalComponent } from './components/trip-planner/modals/invite-modal/invite-modal.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FavouritesComponent } from './components/favourites/favourites.component';
import { SafePipe } from './pipes/safe.pipe';
import { TripPlanModalComponent } from './components/trip-planner/modals/trip-plan-modal/trip-plan-modal.component';
import { MyTripsComponent } from './components/my-trips/my-trips.component';
import { JoinTripComponent } from './components/join-trip/join-trip.component';
import { AddToTripBtnComponent } from './components/add-to-trip-btn/add-to-trip-btn.component';
import { AddToTripModalComponent } from './components/add-to-trip-modal/add-to-trip-modal.component';
import { ItineraryTabComponent } from './components/trip-planner/itinerary-tab/itinerary-tab.component';
import { EditTripModalComponent } from './components/trip-planner/modals/edit-trip-modal/edit-trip-modal.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingpageComponent,
    DestinationComponent,
    PlaceDetailPanelComponent,
    AuthGateModalComponent,
    TripPlannerComponent,
    AddPlaceModalComponent,
    AddDestinationDialogComponent,
    DeleteTripConfirmComponent,
    DeleteDestinationConfirmComponent,
    InviteModalComponent,
    NavbarComponent,
    FavouritesComponent,
    SafePipe,
    TripPlanModalComponent,
    MyTripsComponent,
    JoinTripComponent,
    AddToTripBtnComponent,
    AddToTripModalComponent,
    ItineraryTabComponent,
    EditTripModalComponent,
  ],
  imports: [
    FormsModule,
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatTooltipModule,
    ToastrModule.forRoot({
      timeOut: 2500,
      positionClass: 'toast-bottom-center',
      preventDuplicates: false,
      toastClass: 'wl-toast',
      iconClasses: {
        success: 'wl-toast-success',
        error: 'wl-toast-error',
        info: 'wl-toast-info',
        warning: 'wl-toast-warning'
      },
      easeTime: 0,
      easing: 'ease',
      disableTimeOut: false,
      tapToDismiss: true,
      maxOpened: 1,
      autoDismiss: true,
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
