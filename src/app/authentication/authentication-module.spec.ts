import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthenticationModule } from './authentication-module';

describe('AuthenticationModule', () => {
  let component: AuthenticationModule;
  let fixture: ComponentFixture<AuthenticationModule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AuthenticationModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthenticationModule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
