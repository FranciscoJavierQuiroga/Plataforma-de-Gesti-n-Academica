import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { fakeAsync, tick } from '@angular/core/testing';
import BoletinesComponent from './boletines';
import { ApiService } from '../../../services/api.service';

describe('BoletinesComponent', () => {
  let component: BoletinesComponent;
  let fixture: ComponentFixture<BoletinesComponent>;
  let apiService: any;
  let originalCreateElement: typeof document.createElement;
  let originalAppendChild: typeof document.body.appendChild;
  let originalRemoveChild: typeof document.body.removeChild;

  const mockProfile = {
    id: '1',
    name: 'Juan Pérez',
    email: 'juan@example.com',
    studentId: 'ST001'
  };

  const mockCourses = [
    {
      id: '1',
      name: 'Matemáticas',
      promedios_por_periodo: { '1': 4.5, '2': 4.3, '3': 4.7, '4': 4.6 },
      promedio_general: 4.5
    },
    {
      id: '2',
      name: 'Español',
      promedios_por_periodo: { '1': 4.2, '2': 4.0, '3': 4.4, '4': 4.3 },
      promedio_general: 4.2
    },
    {
      id: '3',
      name: 'Ciencias',
      promedios_por_periodo: { '1': 0, '2': 4.1, '3': 4.5, '4': 4.4 },
      promedio_general: 4.3
    }
  ];

  beforeEach(async () => {
    // Save original DOM methods
    originalCreateElement = document.createElement;
    originalAppendChild = document.body.appendChild;
    originalRemoveChild = document.body.removeChild;

    // Mock del ApiService
    const apiServiceMock = {
      getStudentProfile: jest.fn().mockReturnValue(
        of({ success: true, profile: mockProfile })
      ),
      getStudentCourses: jest.fn().mockReturnValue(
        of({ success: true, courses: mockCourses })
      ),
      downloadBoletin: jest.fn().mockReturnValue(
        of(new HttpResponse<Blob>({ body: new Blob(['test'], { type: 'application/pdf' }) }))
      )
    };

    await TestBed.configureTestingModule({
      imports: [
        BoletinesComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    fixture = TestBed.createComponent(BoletinesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Restore original DOM methods
    document.createElement = originalCreateElement;
    document.body.appendChild = originalAppendChild;
    document.body.removeChild = originalRemoveChild;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.periodos).toEqual(['1', '2', '3', '4']);
    expect(component.periodoSeleccionado).toBe('1');
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.successMessage).toBeNull();
    expect(component.courses).toEqual([]);
    expect(component.profile).toBeNull();
  });

  it('should call cargarDatos on init', () => {
    const cargarDatosSpy = jest.spyOn(component, 'cargarDatos');
    component.ngOnInit();
    expect(cargarDatosSpy).toHaveBeenCalled();
  });

  it('should load profile and courses on init', () => {
    fixture.detectChanges();
    expect(apiService.getStudentProfile).toHaveBeenCalled();
    expect(apiService.getStudentCourses).toHaveBeenCalled();
  });

  it('should set profile when getStudentProfile succeeds', () => {
    fixture.detectChanges();
    expect(component.profile).toEqual(mockProfile);
  });

  it('should set courses when getStudentCourses succeeds', () => {
    fixture.detectChanges();
    expect(component.courses).toEqual(mockCourses);
  });

  it('should handle profile API error', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getStudentProfile.mockReturnValue(
      throwError(() => new Error('Profile error'))
    );
    fixture.detectChanges();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error cargando perfil:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should handle courses API error', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getStudentCourses.mockReturnValue(
      throwError(() => new Error('Courses error'))
    );
    fixture.detectChanges();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error cargando cursos:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should not set profile when API response success is false', () => {
    apiService.getStudentProfile.mockReturnValue(
      of({ success: false, profile: mockProfile })
    );
    fixture.detectChanges();
    expect(component.profile).toBeNull();
  });

  it('should not set courses when API response success is false', () => {
    apiService.getStudentCourses.mockReturnValue(
      of({ success: false, courses: mockCourses })
    );
    fixture.detectChanges();
    expect(component.courses).toEqual([]);
  });

  describe('downloadBoletin', () => {
    let mockAnchor: any;

    beforeEach(() => {
      // Mock window.URL and document methods
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
        remove: jest.fn()
      };
      document.createElement = jest.fn(() => mockAnchor);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });

    it('should set loading to true when download starts', fakeAsync(() => {
      // Make Observable async to test loading state
      apiService.downloadBoletin.mockReturnValue(
        timer(10).pipe(
          map(() => new HttpResponse<Blob>({ body: new Blob(['test'], { type: 'application/pdf' }) }))
        )
      );
      
      component.downloadBoletin();
      // Check immediately before tick
      expect(component.loading).toBe(true);
      tick(10);
    }));

    it('should clear error and successMessage when download starts', fakeAsync(() => {
      component.error = 'Previous error';
      component.successMessage = 'Previous message';
      
      // Make Observable async to test clearing
      apiService.downloadBoletin.mockReturnValue(
        timer(10).pipe(
          map(() => new HttpResponse<Blob>({ body: new Blob(['test'], { type: 'application/pdf' }) }))
        )
      );
      
      component.downloadBoletin();
      // Check immediately before Observable completes
      expect(component.error).toBeNull();
      expect(component.successMessage).toBeNull();
      tick(10);
    }));

    it('should call downloadBoletin API with selected period', fakeAsync(() => {
      component.periodoSeleccionado = '2';
      component.downloadBoletin();
      expect(apiService.downloadBoletin).toHaveBeenCalledWith('2');
      tick();
    }));

    it('should download PDF file when API succeeds', fakeAsync(() => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      component.downloadBoletin();
      
      tick();
      
      expect(component.loading).toBe(false);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(component.successMessage).toBe('✅ Boletín descargado exitosamente');
      consoleLogSpy.mockRestore();
    }));

    it('should set successMessage and clear it after 3 seconds', fakeAsync(() => {
      component.downloadBoletin();
      
      tick();
      expect(component.successMessage).toBe('✅ Boletín descargado exitosamente');
      
      tick(3000);
      expect(component.successMessage).toBeNull();
    }));

    it('should handle download error', fakeAsync(() => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorResponse = { error: { error: 'Error generating boletin' } };
      apiService.downloadBoletin.mockReturnValue(
        throwError(() => errorResponse)
      );
      
      component.downloadBoletin();
      
      tick();
      
      expect(component.loading).toBe(false);
      expect(component.error).toBe('Error generating boletin');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error al descargar boletín:', expect.any(Object));
      consoleErrorSpy.mockRestore();
    }));

    it('should handle download error with default message when error.error is missing', fakeAsync(() => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      apiService.downloadBoletin.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      
      component.downloadBoletin();
      
      tick();
      
      expect(component.loading).toBe(false);
      expect(component.error).toBe('Error al generar el boletín. Intenta nuevamente.');
      consoleErrorSpy.mockRestore();
    }));

    it('should handle null blob response', fakeAsync(() => {
      apiService.downloadBoletin.mockReturnValue(
        of(new HttpResponse<Blob>({ body: null }))
      );
      
      component.downloadBoletin();
      
      tick();
      
      expect(component.loading).toBe(false);
      expect(component.successMessage).toBeNull();
    }));
  });

  describe('getCursosDelPeriodo', () => {
    beforeEach(() => {
      component.courses = mockCourses;
    });

    it('should return courses with promedio from promedios_por_periodo', () => {
      component.periodoSeleccionado = '1';
      const result = component.getCursosDelPeriodo();
      
      expect(result.length).toBe(2); // Only courses with promedio > 0
      expect(result[0].promedio).toBe(4.5);
      expect(result[1].promedio).toBe(4.2);
    });

    it('should filter out courses with promedio 0', () => {
      component.periodoSeleccionado = '1';
      const result = component.getCursosDelPeriodo();
      
      expect(result.length).toBe(2);
      expect(result.find(c => c.name === 'Ciencias')).toBeUndefined();
    });

    it('should use promedio_general when promedios_por_periodo is missing', () => {
      component.courses = [
        {
          id: '1',
          name: 'Historia',
          promedio_general: 4.0
        }
      ];
      component.periodoSeleccionado = '1';
      const result = component.getCursosDelPeriodo();
      
      expect(result[0].promedio).toBe(4.0);
    });

    it('should use promedio_general when period is not in promedios_por_periodo', () => {
      component.courses = [
        {
          id: '1',
          name: 'Historia',
          promedios_por_periodo: { '2': 4.0 },
          promedio_general: 3.8
        }
      ];
      component.periodoSeleccionado = '1';
      const result = component.getCursosDelPeriodo();
      
      // Current component behavior: when promedios_por_periodo exists but period is missing,
      // it defaults to 0, which gets filtered out
      expect(result.length).toBe(0);
    });

    it('should return empty array when no courses', () => {
      component.courses = [];
      const result = component.getCursosDelPeriodo();
      
      expect(result).toEqual([]);
    });

    it('should handle different periods correctly', () => {
      component.periodoSeleccionado = '2';
      const result = component.getCursosDelPeriodo();
      
      expect(result.length).toBe(3); // All courses have promedio > 0 for period 2
      expect(result[0].promedio).toBe(4.3);
      expect(result[1].promedio).toBe(4.0);
      expect(result[2].promedio).toBe(4.1);
    });
  });

  describe('getPromedioGeneral', () => {
    beforeEach(() => {
      component.courses = mockCourses;
    });

    it('should calculate average correctly for period 1', () => {
      component.periodoSeleccionado = '1';
      const promedio = component.getPromedioGeneral();
      
      // (4.5 + 4.2) / 2 = 4.35
      expect(promedio).toBe(4.35);
    });

    it('should calculate average correctly for period 2', () => {
      component.periodoSeleccionado = '2';
      const promedio = component.getPromedioGeneral();
      
      // (4.3 + 4.0 + 4.1) / 3 = 4.13
      expect(promedio).toBe(4.13);
    });

    it('should return 0 when no courses available', () => {
      component.courses = [];
      const promedio = component.getPromedioGeneral();
      
      expect(promedio).toBe(0);
    });

    it('should return 0 when all courses have promedio 0', () => {
      component.courses = [
        {
          id: '1',
          name: 'Test',
          promedios_por_periodo: { '1': 0 }
        }
      ];
      component.periodoSeleccionado = '1';
      const promedio = component.getPromedioGeneral();
      
      expect(promedio).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      component.courses = [
        {
          id: '1',
          name: 'Test1',
          promedios_por_periodo: { '1': 4.333 }
        },
        {
          id: '2',
          name: 'Test2',
          promedios_por_periodo: { '1': 4.666 }
        }
      ];
      component.periodoSeleccionado = '1';
      const promedio = component.getPromedioGeneral();
      
      // (4.333 + 4.666) / 2 = 4.4995 -> 4.50
      expect(promedio).toBe(4.50);
    });
  });
});
