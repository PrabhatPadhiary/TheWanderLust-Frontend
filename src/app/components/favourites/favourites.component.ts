import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { FavouritesService, FavouriteItem } from '../../services/favourites.service';
import { NavHistoryService } from '../../services/nav-history.service';

@Component({
  selector: 'app-favourites',
  templateUrl: './favourites.component.html',
  styleUrls: ['./favourites.component.scss'],
  standalone: false
})
export class FavouritesComponent implements OnInit {
  activeTab: 'all' | 'stays' | 'food' | 'attractions' = 'all';
  favourites: FavouriteItem[] = [];

  constructor(
    public favouritesService: FavouritesService,
    private router: Router,
    private location: Location,
    private navHistory: NavHistoryService
  ) {}

  ngOnInit(): void {
    // Load from API if logged in, otherwise from localStorage
    this.favouritesService.loadFavourites();

    this.favouritesService.favourites$.subscribe(items => {
      this.favourites = items;
    });
  }

  get filteredFavourites(): FavouriteItem[] {
    if (this.activeTab === 'all') return this.favourites;
    const categoryMap: Record<string, string> = {
      stays: 'lodging',
      food: 'restaurant',
      attractions: 'tourist_attraction'
    };
    return this.favourites.filter(f => f.category === categoryMap[this.activeTab]);
  }

  removeFavourite(placeId: string): void {
    this.favouritesService.remove(placeId);
  }

  goBack(): void {
    this.navHistory.goBack();
  }
}
