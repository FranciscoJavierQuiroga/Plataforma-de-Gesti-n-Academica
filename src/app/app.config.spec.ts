import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { App.config } from './app.config';

describe('App.config', () => {
  let component: App.config;
  let fixture: ComponentFixture<App.config>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App.config,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App.config);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
