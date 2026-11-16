import { Component } from '@angular/core';
import { NavHistoryService } from './services/nav-history.service';
import { LoaderService } from './services/loader.service';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'TheWanderLustUI';

  constructor(
    private navHistory: NavHistoryService,
    public loaderService: LoaderService,
    seo: SeoService
  ) {
    seo.init();   // each page's title, description, canonical and link-preview tags
  }
}
