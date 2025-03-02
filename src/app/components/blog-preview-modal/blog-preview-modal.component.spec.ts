import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlogPreviewModalComponent } from './blog-preview-modal.component';

describe('BlogPreviewModalComponent', () => {
  let component: BlogPreviewModalComponent;
  let fixture: ComponentFixture<BlogPreviewModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BlogPreviewModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlogPreviewModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
