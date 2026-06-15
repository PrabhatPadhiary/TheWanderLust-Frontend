import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-features',
  templateUrl: './features.component.html',
  styleUrls: ['./features.component.scss'],
  standalone: false
})
export class FeaturesComponent {
  constructor(private router: Router) {}

  goToExplore(): void {
    this.router.navigate(['/']);
  }

  features = [
    {
      icon: 'search',
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.08)',
      title: 'Smart Discovery',
      subtitle: 'Find the best places instantly',
      desc: 'Search any city or country and instantly surface top-rated stays, restaurants, and attractions — pulled live from Google Places. No curated lists, just real data.',
      bullets: ['Live Google Places data', 'Filter by category & rating', 'Photos, reviews, and directions'],
      mockup: 'destination'
    },
    {
      icon: 'calendar',
      color: '#e85d04',
      bg: 'rgba(232,93,4,0.08)',
      title: 'Trip Planner',
      subtitle: 'Day-by-day itinerary builder',
      desc: 'Drag and drop places into a day-by-day itinerary. Set dates, add notes, track your budget, and share the plan with your travel crew in real time.',
      bullets: ['Drag-and-drop scheduling', 'Budget tracking per trip', 'Collaborative editing'],
      mockup: 'planner'
    },
    {
      icon: 'users',
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.08)',
      title: 'Collaborate',
      subtitle: 'Plan together, travel together',
      desc: 'Invite friends to co-plan trips. Everyone can add places, vote on options, and see changes in real time — no more endless WhatsApp threads.',
      bullets: ['Real-time co-planning', 'Invite via link', 'Role-based access'],
      mockup: 'collaborate'
    },
    {
      icon: 'heart',
      color: '#db2777',
      bg: 'rgba(219,39,119,0.08)',
      title: 'Favourites',
      subtitle: 'Your personal travel wishlist',
      desc: 'Save places across any destination. Build a wishlist of dream spots — hotels, restaurants, landmarks — and access them from any trip.',
      bullets: ['Save across destinations', 'Organised by category', 'Add saved places to trips'],
      mockup: 'favourites'
    },
    {
      icon: 'map',
      color: '#16a34a',
      bg: 'rgba(22,163,74,0.08)',
      title: 'Interactive Maps',
      subtitle: 'See your whole trip at a glance',
      desc: 'Every place in your plan is pinned on a live map. Switch between roadmap and terrain views, see your route, and discover nearby gems you might have missed.',
      bullets: ['Live Google Maps integration', 'All places pinned automatically', 'Roadmap, terrain & satellite views'],
      mockup: 'map'
    },
    {
      icon: 'check',
      color: '#0891b2',
      bg: 'rgba(8,145,178,0.08)',
      title: 'Checklists & Budget',
      subtitle: 'Never forget a thing',
      desc: 'Track packing lists, to-dos, and shared expenses in one place. Split costs with travel mates, see who owes what, and keep totals always up to date.',
      bullets: ['Packing & to-do checklists', 'Expense tracking & splitting', 'Budget vs actual overview'],
      mockup: 'checklist'
    }
  ];
}
