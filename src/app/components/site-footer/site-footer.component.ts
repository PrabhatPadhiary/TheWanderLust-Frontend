import { Component } from '@angular/core';

/** The footer on the public pages (home, features, community): brand, links, copyright. */
@Component({
  selector: 'app-site-footer',
  standalone: false,
  templateUrl: './site-footer.component.html',
  styleUrls: ['./site-footer.component.scss'],
})
export class SiteFooterComponent {
  readonly year = new Date().getFullYear();
}
