import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { fakeAsync, tick } from '@angular/core/testing';
import CertificadosComponent from './certificados';
import { ApiService } from '../../../services/api.service';

describe('CertificadosComponent', () => {
  let component: CertificadosComponent;
  let fixture: ComponentFixture<CertificadosComponent>;
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
      downloadCertificado: jest.fn().mockReturnValue(
        of(new HttpResponse<Blob>({ body: new Blob(['test'], { type: 'application/pdf' }) }))
      )
    };

    await TestBed.configureTestingModule({
      imports: [
        CertificadosComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    fixture = TestBed.createComponent(CertificadosComponent);
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
    expect(component.certificados).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.loadingCertificado).toBeNull();
    expect(component.error).toBeNull();
    expect(component.successMessage).toBeNull();
    expect(component.profile).toBeNull();
  });

  it('should call cargarDatos and inicializarCertificados on init', () => {
    const cargarDatosSpy = jest.spyOn(component, 'cargarDatos');
    const inicializarSpy = jest.spyOn(component, 'inicializarCertificados');
    
    component.ngOnInit();
    
    expect(cargarDatosSpy).toHaveBeenCalled();
    expect(inicializarSpy).toHaveBeenCalled();
  });

  it('should initialize certificados on init', () => {
    component.ngOnInit();
    
    expect(component.certificados.length).toBe(4);
    expect(component.certificados[0].id).toBe('estudio');
    expect(component.certificados[1].id).toBe('notas');
    expect(component.certificados[2].id).toBe('conducta');
    expect(component.certificados[3].id).toBe('asistencia');
  });

  it('should load profile on init', () => {
    component.ngOnInit();
    expect(apiService.getStudentProfile).toHaveBeenCalled();
  });

  it('should set profile when getStudentProfile succeeds', (done) => {
    component.ngOnInit();
    // Wait for async to complete
    setTimeout(() => {
      expect(component.profile).toEqual(mockProfile);
      done();
    }, 100);
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

  it('should not set profile when API response success is false', () => {
    apiService.getStudentProfile.mockReturnValue(
      of({ success: false, profile: mockProfile })
    );
    fixture.detectChanges();
    expect(component.profile).toBeNull();
  });

  describe('descargarCertificado', () => {
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

    it('should set loadingCertificado when download starts', fakeAsync(() => {
      apiService.downloadCertificado.mockReturnValue(
        timer(10).pipe(
          map(() => new HttpResponse<Blob>({ body: new Blob(['test'], { type: 'application/pdf' }) }))
        )
      );
      
      component.descargarCertificado('estudio');
      expect(component.loadingCertificado).toBe('estudio');
      tick(10);
    }));

    it('should clear error and successMessage when download starts', fakeAsync(() => {
      component.error = 'Previous error';
      component.successMessage = 'Previous message';
      
      apiService.downloadCertificado.mockReturnValue(
        timer(10).pipe(
          map(() => new HttpResponse<Blob>({ body: new Blob(['test'], { type: 'application/pdf' }) }))
        )
      );
      
      component.descargarCertificado('notas');
      expect(component.error).toBeNull();
      expect(component.successMessage).toBeNull();
      tick(10);
    }));

    it('should call downloadCertificado API with correct tipo', fakeAsync(() => {
      component.descargarCertificado('conducta');
      expect(apiService.downloadCertificado).toHaveBeenCalledWith('conducta');
      tick();
    }));

    it('should download PDF file when API succeeds', fakeAsync(() => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      component.descargarCertificado('estudio');
      
      tick();
      
      expect(component.loadingCertificado).toBeNull();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(component.successMessage).toContain('Certificado de estudio');
      consoleLogSpy.mockRestore();
    }));

    it('should set successMessage and clear it after 3 seconds', fakeAsync(() => {
      component.descargarCertificado('notas');
      
      tick();
      expect(component.successMessage).toContain('Certificado de notas');
      
      tick(3000);
      expect(component.successMessage).toBeNull();
    }));

    it('should handle download error', fakeAsync(() => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorResponse = { error: { error: 'Error generating certificado' } };
      apiService.downloadCertificado.mockReturnValue(
        throwError(() => errorResponse)
      );
      
      component.descargarCertificado('estudio');
      
      tick();
      
      expect(component.loadingCertificado).toBeNull();
      expect(component.error).toBe('Error generating certificado');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error al descargar certificado:', expect.any(Object));
      consoleErrorSpy.mockRestore();
    }));

    it('should handle download error with default message when error.error is missing', fakeAsync(() => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      apiService.downloadCertificado.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      
      component.descargarCertificado('notas');
      
      tick();
      
      expect(component.loadingCertificado).toBeNull();
      expect(component.error).toBe('Error al generar el certificado. Intenta nuevamente.');
      consoleErrorSpy.mockRestore();
    }));

    it('should handle null blob response', fakeAsync(() => {
      apiService.downloadCertificado.mockReturnValue(
        of(new HttpResponse<Blob>({ body: null }))
      );
      
      component.descargarCertificado('conducta');
      
      tick();
      
      expect(component.loadingCertificado).toBeNull();
      expect(component.successMessage).toBeNull();
    }));
  });

  describe('getNombreCertificado', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should return nombre when certificado exists', () => {
      const nombre = component.getNombreCertificado('estudio');
      expect(nombre).toBe('Certificado de Estudio');
    });

    it('should return tipo when certificado does not exist', () => {
      const nombre = component.getNombreCertificado('inexistente');
      expect(nombre).toBe('inexistente');
    });
  });

  describe('isLoading', () => {
    it('should return true when loadingCertificado matches tipo', () => {
      component.loadingCertificado = 'estudio';
      expect(component.isLoading('estudio')).toBe(true);
    });

    it('should return false when loadingCertificado does not match tipo', () => {
      component.loadingCertificado = 'estudio';
      expect(component.isLoading('notas')).toBe(false);
    });

    it('should return false when loadingCertificado is null', () => {
      component.loadingCertificado = null;
      expect(component.isLoading('estudio')).toBe(false);
    });
  });
});
