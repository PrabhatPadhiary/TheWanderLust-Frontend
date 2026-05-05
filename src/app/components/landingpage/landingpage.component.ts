import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
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

  ngAfterViewInit(): void {
    
    // Ensure video plays (some browsers need programmatic trigger)
    const video = this.bgVideo.nativeElement;
    video.muted = true;
    video.play().catch(() => {});

    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    const scrollIndicatorEl = this.scrollIndicator.nativeElement;

    // 1. Hero split animation timeline
    const splitTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=1200",
        pin: true,
        scrub: 2,
      }
    });

    splitTl
      .to(".word-left", { x: -window.innerWidth, ease: "power2.inOut" }, 0)
      .to(".word-right", { x: window.innerWidth, ease: "power2.inOut" }, 0)
      .to(".tagline-svg", {
        opacity: 0,
        y: -50,
        duration: 0.5
      }, 0.3)
      .to(".search-hub", { 
        scale: 0.85, 
        ease: "power2.inOut", 
        top: 50
      }, 0.4)
      .fromTo(".catalog-section", {
        y: "100%",
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        ease: "power2.out",
      }, 0.5)
      .fromTo(".travel-card", {
        x: 300,
        opacity: 0,
      }, {
        x: 0,
        opacity: 1,
        stagger: 0.15,
        ease: "power2.out",
      }, 0.7);

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
    console.log('Selected:', prediction.description, prediction.place_id);
    // TODO: Navigate to destination page
  }

  onExplore(): void {
    if (this.selectedPlace) {
      console.log('Exploring:', this.selectedPlace.description);
      // TODO: Navigate to destination page
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

  ngOnDestroy(): void {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }
}
