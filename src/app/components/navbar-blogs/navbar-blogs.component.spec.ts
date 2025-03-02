import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarBlogsComponent } from './navbar-blogs.component';

describe('NavbarBlogsComponent', () => {
  let component: NavbarBlogsComponent;
  let fixture: ComponentFixture<NavbarBlogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NavbarBlogsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavbarBlogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
