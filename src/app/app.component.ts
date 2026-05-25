import { Component } from '@angular/core';
import { NavHistoryService } from './services/nav-history.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'TheWanderLustUI';

  // Injecting here ensures the service starts listening to navigation events from app boot
  constructor(private navHistory: NavHistoryService) {}
}
