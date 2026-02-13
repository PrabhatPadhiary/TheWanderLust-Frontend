import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { BlogService } from '../../services/blogs/blog.service';
import { DatePipe } from '@angular/common';
import Swiper from 'swiper';
import { Autoplay, EffectFade, Navigation, Pagination } from 'swiper/modules';

@Component({
  selector: 'app-featured-blogs',
  standalone: false,
  templateUrl: './featured-blogs.component.html',
  styleUrl: './featured-blogs.component.scss'
})
export class FeaturedBlogsComponent implements OnInit, AfterViewInit {

  @ViewChild('swiperContainer', { static: false }) swiperContainer!: ElementRef;
  blogs: any[] = [];
  private swiperInstance: Swiper | null = null;

  constructor(
    private blogService: BlogService,
    private datePipe: DatePipe,
  ){}

  ngOnInit(): void {
    this.blogService.getFeaturedBlogs().subscribe(
      (data) => {
        this.blogs = data;
        this.blogs.forEach(blog => {
          blog.createdAtFormatted = this.datePipe.transform(blog.createdAt, 'fullDate');
        });
      },
      (error) => {
        console.error("Error fetching Blogs");
      }
    );
  }

  ngAfterViewInit(): void {
    if (!this.swiperContainer || !this.swiperContainer.nativeElement) {
      console.error("Swiper container not found!");
      return;
    }

    setTimeout(() => {
      this.swiperInstance = new Swiper(this.swiperContainer.nativeElement, {
        modules: [Autoplay, EffectFade, Pagination, Navigation],
        effect: "slide",
        speed: 1000,
        autoplay: {
          delay: 2000,
          disableOnInteraction: false
        },
        loop: true,
        slidesPerView: 0, 
        slidesPerGroup: 0,
      });
    }, 0);
  }

  ngOnDestroy(): void{
    if (this.swiperInstance) {
      this.swiperInstance.destroy(true, true);
      this.swiperInstance = null;
    }
  }
}
