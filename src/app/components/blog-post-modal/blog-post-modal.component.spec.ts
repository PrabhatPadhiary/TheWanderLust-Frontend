import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlogPostModalComponent } from './blog-post-modal.component';

describe('BlogPostModalComponent', () => {
  let component: BlogPostModalComponent;
  let fixture: ComponentFixture<BlogPostModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BlogPostModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlogPostModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
