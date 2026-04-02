import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import TeacherComponent from './teacher';
import { ApiService } from '../../services/api.service';
import { AlertService } from '../../services/alert.service';
import { of, throwError } from 'rxjs';

describe('TeacherComponent', () => {
  let component: TeacherComponent;
  let fixture: ComponentFixture<TeacherComponent>;
  let apiService: any;
  let alertService: any;
  let router: any;

  const mockGroups = {
    success: true,
    groups: [
      { _id: '1', name: 'Matemáticas 10A', codigo: 'MAT10A', periodo: '1' },
      { _id: '2', name: 'Física 11B', codigo: 'FIS11B', periodo: '2' }
    ]
  };

  beforeEach(async () => {
    // Mock del ApiService
    const apiServiceMock = {
      getTeacherGroups: jest.fn().mockReturnValue(of(mockGroups))
    };

    // Mock del AlertService
    const alertServiceMock = {
      error: jest.fn(),
      success: jest.fn(),
      confirm: jest.fn().mockResolvedValue(true)
    };

    // Mock del Router
    const routerMock = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        TeacherComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: AlertService, useValue: alertServiceMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    alertService = TestBed.inject(AlertService);
    router = TestBed.inject(Router);
    router.navigate = routerMock.navigate;

    fixture = TestBed.createComponent(TeacherComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.groups).toEqual([]);
    expect(component.pending).toBeNull();
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
  });

  it('should call loadGroups on init', () => {
    const loadGroupsSpy = jest.spyOn(component, 'loadGroups');
    component.ngOnInit();
    expect(loadGroupsSpy).toHaveBeenCalled();
  });

  it('should load groups on init', () => {
    fixture.detectChanges();
    expect(apiService.getTeacherGroups).toHaveBeenCalled();
  });

  it('should populate groups when API succeeds', () => {
    fixture.detectChanges();
    expect(component.groups.length).toBe(2);
    expect(component.groups[0].name).toBe('Matemáticas 10A');
  });

  it('should handle error when loading groups', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getTeacherGroups.mockReturnValue(
      throwError(() => new Error('Server error'))
    );
    fixture.detectChanges();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should handle empty groups list', () => {
    apiService.getTeacherGroups.mockReturnValue(
      of({ success: true, groups: [] })
    );
    fixture.detectChanges();
    expect(component.groups).toEqual([]);
  });

  it('should handle groups response without success flag', () => {
    // The component uses res?.groups || [], so it will use groups if they exist
    apiService.getTeacherGroups.mockReturnValue(
      of({ groups: mockGroups.groups })
    );
    fixture.detectChanges();
    // Component will populate groups even without success flag
    expect(component.groups.length).toBe(2);
  });

  describe('logout', () => {
    beforeEach(() => {
      Storage.prototype.removeItem = jest.fn();
    });

    it('should call alertService.confirm', async () => {
      await component.logout();
      expect(alertService.confirm).toHaveBeenCalled();
    });

    it('should clear localStorage when confirmed', async () => {
      alertService.confirm.mockResolvedValue(true);
      await component.logout();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user_role');
      expect(localStorage.removeItem).toHaveBeenCalledWith('userInfo');
    });

    it('should show success message when confirmed', async () => {
      alertService.confirm.mockResolvedValue(true);
      await component.logout();
      
      expect(alertService.success).toHaveBeenCalledWith('Sesión cerrada exitosamente', '👋 Hasta pronto');
    });

    it('should navigate to login when confirmed', async () => {
      alertService.confirm.mockResolvedValue(true);
      jest.useFakeTimers();
      
      await component.logout();
      jest.advanceTimersByTime(1000);
      
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      jest.useRealTimers();
    });

    it('should not logout when cancelled', async () => {
      alertService.confirm.mockResolvedValue(false);
      await component.logout();
      
      expect(localStorage.removeItem).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
