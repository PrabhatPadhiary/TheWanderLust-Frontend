import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule } from '@angular/common/http';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { BlogComponent } from './components/blog/blog.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ContactComponent } from './components/contact/contact.component';
import { AboutComponent } from './components/about/about.component';
import { BlogPostModalComponent } from './components/blog-post-modal/blog-post-modal.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { MatDialogModule } from '@angular/material/dialog';
import { TokenInterceptor } from './interceptors/token/token.interceptor';
import { FeaturedBlogsComponent } from './components/featured-blogs/featured-blogs.component';
import { FeaturedWritersComponent } from './components/featured-writers/featured-writers.component';
import { DatePipe } from '@angular/common';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxMasonryModule } from 'ngx-masonry';
import { BlogPreviewModalComponent } from './components/blog-preview-modal/blog-preview-modal.component';
import { NavbarBlogsComponent } from './components/navbar-blogs/navbar-blogs.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SignupComponent,
    LandingpageComponent,
    BlogComponent,
    NavbarComponent,
    ContactComponent,
    AboutComponent,
    BlogPostModalComponent,
    FeaturedBlogsComponent,
    FeaturedWritersComponent,
    BlogPreviewModalComponent,
    NavbarBlogsComponent,
  ],
  imports: [
    FormsModule,
    NgxMasonryModule,
    InfiniteScrollModule,
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
    MatDialogModule
  ],
  providers: [
    provideAnimationsAsync(),
    DatePipe,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
