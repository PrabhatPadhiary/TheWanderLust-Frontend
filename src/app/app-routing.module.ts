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
import { AboutComponent } from './components/about/about.component';
import { DeleteAccountComponent } from './components/delete-account/delete-account.component';
import { MyJournalsComponent } from './components/my-journals/my-journals.component';
import { LegalComponent } from './components/legal/legal.component';
import { DownloadComponent } from './components/download/download.component';
import { ProfileComponent } from './components/profile/profile.component';
import { SettingsComponent } from './components/settings/settings.component';

const routes: Routes = [
  { path: '', component: LandingPageV2Component, data: { seo: { title: 'Wayraa · Plan trips together, all in one app', description: 'Plan trips together: find stays, food and things to do, plan every day on a map, share one plan with your friends, and keep the budget and checklist in one place. Free on the web and Android.' } } },
  { path: 'home', component: LandingPageV2Component, data: { seo: { title: 'Wayraa · Plan trips together, all in one app', path: '/' } } },
  { path: 'v2', component: LandingPageV2Component, data: { seo: { title: 'Wayraa · Plan trips together, all in one app', path: '/' } } },
  { path: 'destination/:placeId', component: DestinationComponent, data: { seo: { title: 'Explore destinations · Wayraa', description: 'Where to stay, where to eat and things to do, with real ratings and photos, all on one map.' } } },
  { path: 'trip-planner', component: TripPlannerComponent, data: { seo: { title: 'Trip planner · Wayraa', noindex: true } } },
  { path: 'trip-planner/:tripId', component: TripPlannerComponent, data: { seo: { title: 'Trip planner · Wayraa', noindex: true } } },
  { path: 'join/:tripId', component: JoinTripComponent, data: { seo: { title: 'Join a trip · Wayraa', noindex: true } } },
  { path: 'favourites', component: FavouritesComponent, data: { seo: { title: 'Favourites · Wayraa', noindex: true } } },
  { path: 'my-trips', component: MyTripsComponent, data: { seo: { title: 'My trips · Wayraa', noindex: true } } },
  { path: 'community', component: CommunityComponent, data: { seo: { title: 'Travel stories from real travellers · Wayraa', description: 'Trip stories, itineraries, places and tips shared by real travellers on Wayraa. Read where they went, what they did and what it cost.' } } },
  { path: 'community/write', component: WriteJournalComponent, data: { seo: { title: 'Write a story · Wayraa', noindex: true } } },
  { path: 'community/story/:id', component: JournalDetailComponent, data: { seo: { title: 'Travel story · Wayraa' } } },
  { path: 'my-stories', component: MyJournalsComponent, data: { seo: { title: 'Your stories · Wayraa', noindex: true } } },
  // Old addresses (links already shared, and the app's share links): keep working.
  { path: 'community/journal/:id', redirectTo: 'community/story/:id' },
  { path: 'my-journals', redirectTo: 'my-stories' },
  { path: 'features', component: FeaturesComponent, data: { seo: { title: 'Features · A group trip planner that does it all · Wayraa', description: 'Find places, save favourites, make a trip, plan every day on a map, plan with friends live, and track the budget and checklist. See how Wayraa works, from first idea to the last photo.' } } },
  { path: 'pricing', component: PricingComponent, data: { seo: { title: 'Pricing · Wayraa', description: 'Wayraa is free while in beta, on the web and on Android.' } } },
  { path: 'about', component: AboutComponent, data: { seo: { title: 'About Wayraa · Built by a traveller, for every traveller', description: 'Why Wayraa exists: years of trying to fix group trip planning, the Excel sheets and endless group chats, and the app that finally came out of it. From founder Prabhat Padhiary.' } } },
  { path: 'delete-account', component: DeleteAccountComponent, data: { seo: { title: 'Delete your account · Wayraa', description: 'How to delete your Wayraa account and its data: in the app, on the website or by email, and what happens to your information.' } } },
  // Linked from the mobile app and from Google's sign-in consent screen.
  { path: 'privacy', component: LegalComponent, data: { doc: 'privacy', seo: { title: 'Privacy Policy · Wayraa', description: 'What information Wayraa collects, why, who can see it, and how to delete it.' } } },
  { path: 'child-safety', component: LegalComponent, data: { doc: 'child-safety', seo: { title: 'Child Safety Standards · Wayraa', description: 'Wayraa\'s standards against child sexual abuse and exploitation, and how to report it.' } } },
  { path: 'terms', component: LegalComponent, data: { doc: 'terms', seo: { title: 'Terms of Use · Wayraa', description: 'The terms for using Wayraa\'s app and website.' } } },
  { path: 'download', component: DownloadComponent, data: { seo: { title: 'Get Wayraa for Android (Beta)', description: 'Download the Wayraa Android app: plan trips together, find places and keep the whole trip in one place. Free beta.' } } },
  { path: 'profile', component: ProfileComponent, data: { seo: { title: 'Your profile · Wayraa', noindex: true } } },
  { path: 'settings', component: SettingsComponent, data: { seo: { title: 'Settings · Wayraa', noindex: true } } },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
