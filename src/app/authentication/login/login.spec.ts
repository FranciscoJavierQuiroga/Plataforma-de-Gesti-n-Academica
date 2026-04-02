import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import LoginComponent from './login'; // Note: default import, no curly braces
import { ApiService } from '../../services/api.service';
import { of, throwError, Observable } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let apiService: ApiService;
  let mockRouter: any;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    mockRouter = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent, // Import as standalone component
        FormsModule,
        CommonModule,
        HttpClientTestingModule
      ],
      providers: [
        { provide: Router, useValue: mockRouter },
        ApiService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
    Storage.prototype.clear = jest.fn();
    
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty username and password', () => {
    expect(component.username).toBe('');
    expect(component.password).toBe('');
  });

  it('should show error when username is empty', async () => {
    component.username = '';
    component.password = 'password123';
    
    await component.login(new Event('submit'));
    
    expect(component.error).toBe('Usuario y contraseña son requeridos');
  });

  it('should show error when password is empty', async () => {
    component.username = 'testuser';
    component.password = '';
    
    await component.login(new Event('submit'));
    
    expect(component.error).toBe('Usuario y contraseña son requeridos');
  });

  it('should call login API with correct credentials', () => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    expect(apiService.login).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123'
    });
  });

  it('should store token in localStorage on successful login', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'fake-jwt-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('user_role', 'estudiante');
      done();
    }, 100);
  });

  it('should navigate to student dashboard for estudiante role', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/student']);
      done();
    }, 100);
  });

  it('should navigate to teacher dashboard for docente role', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'docente'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/teacher']);
      done();
    }, 100);
  });

  it('should navigate to admin dashboard for administrador role', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'administrador'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
      done();
    }, 100);
  });

  it('should show error when user has no role', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: null
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(component.error).toBe('Inicio de sesión correcto pero el usuario no tiene rol asignado.');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should not navigate for unauthorized role', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'unauthorized'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(component.error).toBe('Rol no reconocido: unauthorized');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should handle API error', (done) => {
    const errorResponse = { 
      message: 'Invalid credentials' 
    };

    component.username = 'testuser';
    component.password = 'wrongpassword';

    jest.spyOn(apiService, 'login').mockReturnValue(
      throwError(() => errorResponse)
    );

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(component.error).toBe('Invalid credentials');
      expect(component.loading).toBe(false);
      done();
    }, 100);
  });

  it('should set loading to true during login', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    component.username = 'testuser';
    component.password = 'password123';

    // Use a delayed observable to simulate async behavior
    const delayedResponse$ = new Observable(subscriber => {
      setTimeout(() => {
        subscriber.next(mockResponse);
        subscriber.complete();
      }, 50);
    });

    jest.spyOn(apiService, 'login').mockReturnValue(delayedResponse$);

    expect(component.loading).toBe(false);
    component.login(new Event('submit'));
    
    // Check immediately after calling login
    setTimeout(() => {
      expect(component.loading).toBe(true);
      done();
    }, 10);
  });

  it('should set loading to false after login completes', (done) => {
    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    component.username = 'testuser';
    component.password = 'password123';

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    setTimeout(() => {
      expect(component.loading).toBe(false);
      done();
    }, 100);
  });

  it('should clear error on new login attempt', () => {
    component.error = 'Previous error';
    component.username = 'testuser';
    component.password = 'password123';

    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(new Event('submit'));

    expect(component.error).toBeNull();
  });

  it('should prevent default form submission', () => {
    const mockEvent = new Event('submit');
    jest.spyOn(mockEvent, 'preventDefault');

    component.username = 'testuser';
    component.password = 'password123';

    const mockResponse = {
      access_token: 'fake-jwt-token',
      role: 'estudiante'
    };

    jest.spyOn(apiService, 'login').mockReturnValue(of(mockResponse));

    component.login(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});