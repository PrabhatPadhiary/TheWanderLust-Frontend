import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.scss'],
  standalone: false
})
export class PricingComponent {
  billing: 'monthly' | 'yearly' = 'yearly';

  constructor(public authService: AuthService, private router: Router) {}

  plans = [
    {
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      description: 'For solo travelers just getting started.',
      cta: 'Get Started Free',
      ctaStyle: 'outline',
      badge: null,
      features: [
        { text: 'Explore up to 5 destinations/month', included: true },
        { text: 'Basic trip planner (1 active trip)', included: true },
        { text: 'Save up to 20 favourites', included: true },
        { text: 'Community access (read-only)', included: true },
        { text: 'Collaborative planning', included: false },
        { text: 'Budget & expense tracking', included: false },
        { text: 'Unlimited trips', included: false },
        { text: 'Priority support', included: false },
      ]
    },
    {
      name: 'Pro',
      price: { monthly: 9, yearly: 6 },
      description: 'For frequent travelers who plan seriously.',
      cta: 'Start Pro Free — 14 days',
      ctaStyle: 'primary',
      badge: 'Most Popular',
      features: [
        { text: 'Unlimited destination exploration', included: true },
        { text: 'Unlimited trips & itineraries', included: true },
        { text: 'Unlimited favourites', included: true },
        { text: 'Full community access + post journals', included: true },
        { text: 'Collaborative planning (up to 5 people)', included: true },
        { text: 'Budget & expense tracking', included: true },
        { text: 'Checklists & packing lists', included: true },
        { text: 'Priority support', included: false },
      ]
    },
    {
      name: 'Team',
      price: { monthly: 19, yearly: 14 },
      description: 'For groups, travel agents, and power users.',
      cta: 'Contact Sales',
      ctaStyle: 'outline',
      badge: null,
      features: [
        { text: 'Everything in Pro', included: true },
        { text: 'Unlimited collaborators per trip', included: true },
        { text: 'Team workspace & shared favourites', included: true },
        { text: 'Advanced analytics & export', included: true },
        { text: 'Custom trip templates', included: true },
        { text: 'White-label trip sharing links', included: true },
        { text: 'Dedicated account manager', included: true },
        { text: 'Priority support + SLA', included: true },
      ]
    }
  ];

  faqs = [
    { q: 'Is the free plan really free forever?', a: 'Yes — no credit card required, no trial expiry. The free tier is always free.' },
    { q: 'Can I switch plans at any time?', a: 'Absolutely. Upgrade or downgrade at any point. Prorated credits are applied automatically.' },
    { q: 'What happens to my data if I downgrade?', a: 'Your trips and data are preserved. You\'ll just lose access to Pro features — nothing is deleted.' },
    { q: 'Is there a discount for yearly billing?', a: 'Yes — yearly billing saves you ~33% compared to monthly. Toggle above to see yearly prices.' },
  ];

  openFaq: number | null = null;

  toggleFaq(i: number): void {
    this.openFaq = this.openFaq === i ? null : i;
  }

  getPrice(plan: typeof this.plans[0]): string {
    const p = plan.price[this.billing];
    return p === 0 ? 'Free' : `$${p}`;
  }

  onCta(plan: typeof this.plans[0]): void {
    if (plan.name === 'Free' || plan.name === 'Pro') {
      if (this.authService.isLoggedIn) {
        this.router.navigate(['/']);
      } else {
        this.router.navigate(['/']);
      }
    }
  }
}
