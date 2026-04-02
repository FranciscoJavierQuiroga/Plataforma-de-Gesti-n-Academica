import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { App.routes } from './app.routes';

describe('App.routes', () => {
  let component: App.routes;
  let fixture: ComponentFixture<App.routes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App.routes,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App.routes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
