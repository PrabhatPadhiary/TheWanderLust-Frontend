import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeaturedWritersComponent } from './featured-writers.component';

describe('FeaturedWritersComponent', () => {
  let component: FeaturedWritersComponent;
  let fixture: ComponentFixture<FeaturedWritersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FeaturedWritersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeaturedWritersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
