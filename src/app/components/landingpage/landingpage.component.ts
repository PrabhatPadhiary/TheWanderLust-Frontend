import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

@Component({
  selector: 'app-landingpage',
  templateUrl: './landingpage.component.html',
  styleUrls: ['./landingpage.component.scss'],
  standalone: false
})
export class LandingpageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('travelPath') travelPath!: ElementRef<SVGPathElement>;
  @ViewChild('movingContainer') movingContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('mainTrigger') mainTrigger!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollIndicator') scrollIndicator!: ElementRef<HTMLDivElement>;
  @ViewChild('zoomTarget') zoomTarget!: ElementRef<SVGTSpanElement>;

  ngAfterViewInit(): void {
    
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    const scrollIndicatorEl = this.scrollIndicator.nativeElement;

    // 1. Hero split animation timeline - simple and clean
    const splitTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=1500", // Increased for more comfortable pacing
        pin: true,
        scrub: 1,
      }
    });

    splitTl
      .to(".word-left", { x: -window.innerWidth }, 0)
      .to(".word-right", { x: window.innerWidth }, 0)
      .to(".tagline-svg", {
        opacity: 0,
        y: -50,
        duration: 0.5
      }, 0.3)
      .to(".search-hub", { 
        scale: 0.85, 
        ease: "power2.inOut", 
        top: 50
      }, 0.5);

    // 2. Scroll indicator fade + slide
    gsap.to(scrollIndicatorEl, {
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",        // start fading as soon as hero hits top
        end: "bottom center",    // fade out when hero is halfway off screen
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
        scrollTo: window.innerHeight + 100, // scroll slightly past hero
        duration: 1.2,
        ease: "power2.inOut"
      });
    });

    this.initJourneyTimeline();
  }

  private initJourneyTimeline(): void {
    const path = this.travelPath.nativeElement;
    const container = this.mainTrigger.nativeElement;
    const moving = this.movingContainer.nativeElement;

    const pathLength = path.getTotalLength();
    gsap.set(path, {
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength
    });

    const scrollDistance = moving.offsetHeight - window.innerHeight;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: "top bottom",
        end: () => "+=" + scrollDistance, // Keep it synchronized
        scrub: 8, // Increased from 5 for slower, smoother animation
        pin: true,
        anticipatePin: 1
      }
    });

    tl.to(path, { strokeDashoffset: 0, ease: "none" }, 0);
    tl.to(moving, { y: -scrollDistance, ease: "none" }, 0);

    tl.from(".travel-card", {
      y: 100,
      opacity: 0,
      stagger: 0.2,
      duration: 1
    }, 0.1);
  }

  ngOnDestroy(): void {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }
}
