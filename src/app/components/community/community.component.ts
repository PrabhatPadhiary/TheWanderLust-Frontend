import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export interface TripJournal {
  id: string;
  authorName: string;
  authorInitial: string;
  authorColor: string;
  authorLocation: string;
  tripCount: number;
  destinationName: string;
  destinationCountry: string;
  month: string;
  title: string;
  excerpt: string;
  tags: string[];
  placesMentioned: string[];
  likes: number;
  comments: number;
  saves: number;
  tripBadge: string | null;
  imageUrl: string | null;
}

export interface CommunityQuestion {
  id: string;
  text: string;
  destination: string;
  answers: number;
  tag: string;
}

export interface TrendingDestination {
  name: string;
  tripsPlanned: number;
  change: number;
}

export interface TopTraveler {
  name: string;
  initial: string;
  color: string;
  trips: number;
  badge: string;
  budget: string;
  saves: number;
}

@Component({
  selector: 'app-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
  standalone: false
})
export class CommunityComponent implements OnInit {

  activeTab: 'journals' | 'ask' | 'squads' | 'trending' = 'journals';
  journalSort: 'recent' | 'popular' = 'recent';

  stats = [
    { value: '2,400+', label: 'Travellers' },
    { value: '840',    label: 'Trip Journals' },
    { value: '190+',   label: 'Destinations' },
    { value: '3.2K',   label: 'Questions Answered' },
  ];

  journals: TripJournal[] = [
    {
      id: '1',
      authorName: 'Rahul Menon',
      authorInitial: 'R',
      authorColor: '#e85d04',
      authorLocation: 'Mumbai',
      tripCount: 12,
      destinationName: 'Wayanad, Kerala',
      destinationCountry: 'India',
      month: 'June 2024',
      title: 'Monsoon magic in Wayanad — the waterfalls were unreal',
      excerpt: 'Went in with zero expectations during off-season and came back completely blown away. Soochipara falls was at full force, the tea estates were misty and green, and we barely met another tourist. Best decision we made.',
      tags: ['Adventure', 'Nature'],
      placesMentioned: ['Sythil Village Resort', 'Soochipara Falls', 'Pepper Vine Restaurant'],
      likes: 142,
      comments: 28,
      saves: 0,
      tripBadge: '5 day trip',
      imageUrl: 'assets/images/background/card-bg1.jpg'
    },
    {
      id: '2',
      authorName: 'Priya Sharma',
      authorInitial: 'P',
      authorColor: '#2563eb',
      authorLocation: 'Bangalore',
      tripCount: 7,
      destinationName: 'Dubai, UAE',
      destinationCountry: 'UAE',
      month: 'May 2024',
      title: 'First timer in Dubai — what I wish I knew beforehand',
      excerpt: 'Booked on a whim and almost got overwhelmed by the options. The desert safari at sunset was the highlight. Skip the mall and walk the old spice souk instead — completely different vibe.',
      tags: ['City', 'Food'],
      placesMentioned: ['Spice Souk', 'Al Fahidi Fort', 'Ravi Restaurant'],
      likes: 89,
      comments: 15,
      saves: 0,
      tripBadge: '4p',
      imageUrl: 'assets/images/background/card-bg2.jpg'
    },
    {
      id: '3',
      authorName: 'Ananya Roy',
      authorInitial: 'A',
      authorColor: '#16a34a',
      authorLocation: 'Delhi',
      tripCount: 19,
      destinationName: 'Coorg, Karnataka',
      destinationCountry: 'India',
      month: 'April 2024',
      title: 'A weekend in Coorg with the family — coffee trails and cozy stays',
      excerpt: 'Perfect for a 2-night getaway. We did a coffee plantation walk in the morning, sat by the Cauvery in the evening. Kids loved it. Booked everything through Wayraa and saved a ton of planning time.',
      tags: ['Family', 'Nature'],
      placesMentioned: ['Dubare Elephant Camp', 'Madikeri Fort', 'Abbey Falls'],
      likes: 211,
      comments: 41,
      saves: 0,
      tripBadge: null,
      imageUrl: 'assets/images/background/card-bg3.jpg'
    }
  ];

  questions: CommunityQuestion[] = [
    { id: '1', text: 'Is Wayanad worth visiting in June during monsoon?', destination: 'Wayanad', answers: 14, tag: 'Wayanad' },
    { id: '2', text: 'Best budget stays near Dubai Metro line?', destination: 'Dubai', answers: 6, tag: 'Dubai' },
    { id: '3', text: 'Solo female travel in Coorg — is it safe?', destination: 'Coorg', answers: 21, tag: 'Coorg' },
    { id: '4', text: 'How many days is enough for Manali in October?', destination: 'Manali', answers: 33, tag: 'Manali' },
    { id: '5', text: 'Best rooftop cafes in Goa that aren\'t touristy?', destination: 'Goa', answers: 9, tag: 'Goa' },
  ];

  trending: TrendingDestination[] = [
    { name: 'Wayanad, Kerala',  tripsPlanned: 289, change: 32 },
    { name: 'Coorg, Karnataka', tripsPlanned: 193, change: 18 },
    { name: 'Dubai, UAE',       tripsPlanned: 154, change: 12 },
    { name: 'Manali, HP',       tripsPlanned: 142, change: 8  },
    { name: 'Goa',              tripsPlanned: 381, change: 5  },
  ];

  topTravelers: TopTraveler[] = [
    { name: 'Rahul Menon',  initial: 'R', color: '#e85d04', trips: 12, badge: 'Adventure', budget: '₹45', saves: 3 },
    { name: 'Priya Nair',   initial: 'P', color: '#db2777', trips: 9,  badge: 'Foodie',    budget: '₹30', saves: 0 },
    { name: 'Karan Mehta',  initial: 'K', color: '#7c3aed', trips: 15, badge: 'Budget Pro', budget: '₹20', saves: 1 },
  ];

  newQuestion = '';

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  setTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  setSort(sort: typeof this.journalSort): void {
    this.journalSort = sort;
  }

  goToDestination(name: string): void {
    // Navigate to search with destination name pre-filled (future: resolve placeId)
    this.router.navigate(['/']);
  }

  submitQuestion(): void {
    if (!this.newQuestion.trim()) return;
    this.questions.unshift({
      id: Date.now().toString(),
      text: this.newQuestion.trim(),
      destination: 'General',
      answers: 0,
      tag: 'General'
    });
    this.newQuestion = '';
  }

  likeJournal(journal: TripJournal): void {
    journal.likes++;
  }

  saveJournal(journal: TripJournal): void {
    journal.saves++;
  }
}
