import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare var google: any;

@Component({
  selector: 'app-landingpage',
  templateUrl: './landingpage.component.html',
  styleUrls: ['./landingpage.component.scss'],
  standalone: false
})
export class LandingpageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollIndicator') scrollIndicator!: ElementRef<HTMLDivElement>;
  @ViewChild('zoomTarget') zoomTarget!: ElementRef<SVGTSpanElement>;
  @ViewChild('bgVideo') bgVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('catalogSection') catalogSection!: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  predictions: any[] = [];
  showDropdown = false;
  selectedPlace: any = null;

  private searchSubject = new Subject<string>();
  private autocompleteService: any;
  private blurTimeout: any;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    
    // Ensure video plays (some browsers need programmatic trigger)
    const video = this.bgVideo.nativeElement;
    video.muted = true;
    video.play().catch(() => {});

    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    const scrollIndicatorEl = this.scrollIndicator.nativeElement;

    // 2. Scroll indicator fade + slide
    gsap.to(scrollIndicatorEl, {
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom center",
        scrub: true,
      },
      y: 20,
      opacity: 0,
      scale: 0.8,
      ease: "power1.out",
    });

    // 3. Click scroll
    scrollIndicatorEl.addEventListener("click", () => {
      gsap.to(window, {
        scrollTo: window.innerHeight + 100,
        duration: 1.2,
        ease: "power2.inOut"
      });
    });

    this.initCatalogAnimation();
    this.initShowcaseAnimation();
    this.initPlacesAutocomplete();
  }

  private initPlacesAutocomplete(): void {
    this.autocompleteService = new google.maps.places.AutocompleteService();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(value => value.length >= 2)
    ).subscribe(value => {
      this.autocompleteService.getPlacePredictions(
        { input: value },
        (predictions: any[], status: string) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const allowedTypes = [
              'locality',
              'administrative_area_level_1',
              'country'
            ];

            this.predictions = predictions
              .filter(pred => pred.types?.some((type: string) => allowedTypes.includes(type)))
              .sort((a, b) => {
                const priority = (types: string[]) => {
                  if (types.includes('locality')) return 1;
                  if (types.includes('administrative_area_level_1')) return 2;
                  if (types.includes('country')) return 3;
                  return 4;
                };
                return priority(a.types) - priority(b.types);
              });

            this.showDropdown = this.predictions.length > 0;
          } else {
            this.predictions = [];
            this.showDropdown = false;
          }
        }
      );
    });
  }

  getPlaceLabel(prediction: any): string {
    if (prediction.types?.includes('locality')) return 'City';
    if (prediction.types?.includes('administrative_area_level_1')) return 'State';
    if (prediction.types?.includes('country')) return 'Country';
    return '';
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value.length < 2) {
      this.predictions = [];
      this.showDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  selectPlace(prediction: any): void {
    this.selectedPlace = prediction;
    this.searchInput.nativeElement.value = prediction.structured_formatting.main_text;
    this.predictions = [];
    this.showDropdown = false;
    this.router.navigate(['/destination', prediction.place_id]);
  }

  onExplore(): void {
    if (this.selectedPlace) {
      this.router.navigate(['/destination', this.selectedPlace.place_id]);
    }
  }

  onBlur(): void {
    this.blurTimeout = setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  private initCatalogAnimation(): void {
    // Catalog animates as part of the hero timeline now
  }

  private initShowcaseAnimation(): void {
    const section = this.catalogSection.nativeElement;
    const leftCard = section.querySelector('[data-card="left"]');
    const centerCard = section.querySelector('[data-card="center"]');
    const rightCard = section.querySelector('[data-card="right"]');
    const panel = section.querySelector('.showcase-panel');
    const panelLeft = section.querySelector('[data-panel="left"]');
    const panelCenter = section.querySelector('[data-panel="center"]');
    const panelRight = section.querySelector('[data-panel="right"]');
    const textBlock = section.querySelector('.text-block');
    const showcaseText = section.querySelector('.showcase-text');

    // Set initial hidden states
    gsap.set(showcaseText, { opacity: 0, y: 30 });
    gsap.set(panel, { opacity: 0, x: 80 });
    gsap.set(panelLeft, { opacity: 0 });
    gsap.set(panelCenter, { opacity: 0 });
    gsap.set(panelRight, { opacity: 0 });

    const showcaseCta = section.querySelector('.showcase-cta');
    gsap.set(showcaseCta, { opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=5000",
        pin: true,
        scrub: 2,
      }
    });

    // === Phase 1: Hero intro (0 - 0.15) ===
    tl.to(".word-left", { x: -window.innerWidth, ease: "power2.inOut", duration: 0.08 }, 0)
      .to(".word-right", { x: window.innerWidth, ease: "power2.inOut", duration: 0.08 }, 0)
      .to(".tagline-svg", { opacity: 0, y: -50, duration: 0.04 }, 0.04)
      .to(".search-hub", { scale: 0.85, ease: "power2.inOut", top: 50, duration: 0.04 }, 0.06)
      .fromTo(".catalog-section", { y: "100%", opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", duration: 0.06 }, 0.08)
      .fromTo(".travel-card", { x: 300, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.02, ease: "power2.out", duration: 0.05 }, 0.12);

    // === Phase 2: Focus on LEFT card (Lofoten) (0.22 - 0.40) ===
    tl.to(textBlock, { opacity: 0, y: -30, duration: 0.04 }, 0.22)
      .to(section, { backgroundColor: "#0a1f12", duration: 0.06 }, 0.24)
      .to(".glass-search-bar input", { color: "#fff", duration: 0.04, onStart: () => {
        document.querySelector('.glass-search-bar')?.classList.add('dark-mode');
      }, onReverseComplete: () => {
        document.querySelector('.glass-search-bar')?.classList.remove('dark-mode');
      }}, 0.24)
      .to(".glass-search-bar .search-icon", { color: "#fff", duration: 0.04 }, 0.24)
      .to(".glass-search-bar", { borderColor: "rgba(255,255,255,0.2)", duration: 0.04 }, 0.24)
      .to(showcaseText, { opacity: 1, y: 0, duration: 0.05 }, 0.27)
      .to(centerCard, { opacity: 0, scale: 0.8, duration: 0.04 }, 0.26)
      .to(rightCard, { opacity: 0, scale: 0.8, duration: 0.04 }, 0.26)
      .to(leftCard, { scale: 1.1, x: 150, duration: 0.05 }, 0.27)
      // Panel slides in once + show Lofoten content
      .to(panel, { opacity: 1, x: 0, duration: 0.05 }, 0.30)
      .to(panelLeft, { opacity: 1, duration: 0.04 }, 0.30)
      .to(showcaseCta, { opacity: 1, duration: 0.04 }, 0.32);

    // === Phase 3: Cross-fade to CENTER content (Santorini) (0.44 - 0.56) ===
    tl.to(panelLeft, { opacity: 0, duration: 0.04 }, 0.44)
      .to(leftCard, { opacity: 0, scale: 0.8, duration: 0.04 }, 0.44)
      .to(centerCard, { opacity: 1, scale: 1.1, x: -165, duration: 0.05 }, 0.49)
      .to(panelCenter, { opacity: 1, duration: 0.04 }, 0.49);

    // === Phase 4: Cross-fade to RIGHT content (Bali) (0.60 - 0.72) ===
    tl.to(panelCenter, { opacity: 0, duration: 0.04 }, 0.60)
      .to(centerCard, { opacity: 0, scale: 0.8, duration: 0.04 }, 0.60)
      .to(rightCard, { opacity: 1, scale: 1.1, x: -480, duration: 0.05 }, 0.65)
      .to(panelRight, { opacity: 1, duration: 0.04 }, 0.65);

    // === Phase 5: Hold final state (0.75 - 1.0) ===
  }

  ngOnDestroy(): void {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }
}
