import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserResponse } from '../../services/auth.service';

@Component({
  selector: 'app-trip-planner',
  templateUrl: './trip-planner.component.html',
  styleUrls: ['./trip-planner.component.scss'],
  standalone: false
})
export class TripPlannerComponent implements OnInit {
  user: UserResponse | null = null;
  destination: string = '';
  isGuest = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const state = history.state;
    this.user = state?.user || null;
    this.destination = state?.destination || '';
    this.isGuest = state?.isGuest || false;
  }
}
