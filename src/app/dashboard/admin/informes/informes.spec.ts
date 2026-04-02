import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Informes } from './informes';
import { ApiService } from '../../../services/api.service';

describe('Informes', () => {
  let component: Informes;
  let fixture: ComponentFixture<Informes>;
  let mockRouter: any;
  let apiService: ApiService;

  beforeEach(async () => {
    mockRouter = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        Informes,
        HttpClientTestingModule,
        CommonModule
      ],
      providers: [
        ApiService,
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Informes);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have loading set to false', () => {
      expect(component.loading).toBe(false);
    });

    it('should have 5 tipos de informes', () => {
      expect(component.tiposInformes.length).toBe(5);
    });

    it('should have estudiantes report type', () => {
      const estudiantesReport = component.tiposInformes.find(t => t.id === 'estudiantes');
      expect(estudiantesReport).toBeDefined();
      expect(estudiantesReport?.nombre).toBe('Reporte de Estudiantes');
      expect(estudiantesReport?.descripcion).toBe('Lista completa de estudiantes matriculados');
      expect(estudiantesReport?.icono).toBe('👥');
    });

    it('should have calificaciones report type', () => {
      const calificacionesReport = component.tiposInformes.find(t => t.id === 'calificaciones');
      expect(calificacionesReport).toBeDefined();
      expect(calificacionesReport?.nombre).toBe('Reporte de Calificaciones');
      expect(calificacionesReport?.descripcion).toBe('Consolidado de notas por periodo');
      expect(calificacionesReport?.icono).toBe('📊');
    });

    it('should have asistencia report type', () => {
      const asistenciaReport = component.tiposInformes.find(t => t.id === 'asistencia');
      expect(asistenciaReport).toBeDefined();
      expect(asistenciaReport?.nombre).toBe('Reporte de Asistencia');
      expect(asistenciaReport?.descripcion).toBe('Registro de asistencia por grupo');
      expect(asistenciaReport?.icono).toBe('📅');
    });

    it('should have docentes report type', () => {
      const docentesReport = component.tiposInformes.find(t => t.id === 'docentes');
      expect(docentesReport).toBeDefined();
      expect(docentesReport?.nombre).toBe('Reporte de Docentes');
      expect(docentesReport?.descripcion).toBe('Lista de profesores y asignaturas');
      expect(docentesReport?.icono).toBe('👨‍🏫');
    });

    it('should have financiero report type', () => {
      const financieroReport = component.tiposInformes.find(t => t.id === 'financiero');
      expect(financieroReport).toBeDefined();
      expect(financieroReport?.nombre).toBe('Reporte Financiero');
      expect(financieroReport?.descripcion).toBe('Estado de pagos y cartera');
      expect(financieroReport?.icono).toBe('💰');
    });

    it('should have all report types with required properties', () => {
      component.tiposInformes.forEach(tipo => {
        expect(tipo.id).toBeDefined();
        expect(tipo.nombre).toBeDefined();
        expect(tipo.descripcion).toBeDefined();
        expect(tipo.icono).toBeDefined();
      });
    });
  });

  describe('generarInforme', () => {
    const mockTipo = {
      id: 'estudiantes',
      nombre: 'Reporte de Estudiantes',
      descripcion: 'Lista completa de estudiantes matriculados',
      icono: '👥'
    };

    beforeEach(() => {
      jest.spyOn(window, 'alert').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();
    });

    it('should set loading to true when generating report', () => {
      expect(component.loading).toBe(false);
      component.generarInforme(mockTipo);
      expect(component.loading).toBe(true);
    });

    it('should log report generation message', () => {
      component.generarInforme(mockTipo);
      expect(console.log).toHaveBeenCalledWith('Generando informe: Reporte de Estudiantes');
    });

    it('should set loading to false after timeout', fakeAsync(() => {
      component.generarInforme(mockTipo);
      expect(component.loading).toBe(true);

      tick(1500);

      expect(component.loading).toBe(false);
    }));

    it('should show success alert after report generation', fakeAsync(() => {
      component.generarInforme(mockTipo);

      tick(1500);

      expect(window.alert).toHaveBeenCalledWith(
        'Informe "Reporte de Estudiantes" generado exitosamente.\n\nEn producción, este PDF se descargaría automáticamente.'
      );
    }));

    it('should handle calificaciones report', fakeAsync(() => {
      const calificacionesTipo = component.tiposInformes.find(t => t.id === 'calificaciones')!;
      
      component.generarInforme(calificacionesTipo);
      
      expect(console.log).toHaveBeenCalledWith('Generando informe: Reporte de Calificaciones');
      
      tick(1500);
      
      expect(window.alert).toHaveBeenCalledWith(
        'Informe "Reporte de Calificaciones" generado exitosamente.\n\nEn producción, este PDF se descargaría automáticamente.'
      );
      expect(component.loading).toBe(false);
    }));

    it('should handle asistencia report', fakeAsync(() => {
      const asistenciaTipo = component.tiposInformes.find(t => t.id === 'asistencia')!;
      
      component.generarInforme(asistenciaTipo);
      
      expect(console.log).toHaveBeenCalledWith('Generando informe: Reporte de Asistencia');
      
      tick(1500);
      
      expect(component.loading).toBe(false);
    }));

    it('should handle docentes report', fakeAsync(() => {
      const docentesTipo = component.tiposInformes.find(t => t.id === 'docentes')!;
      
      component.generarInforme(docentesTipo);
      
      expect(console.log).toHaveBeenCalledWith('Generando informe: Reporte de Docentes');
      
      tick(1500);
      
      expect(component.loading).toBe(false);
    }));

    it('should handle financiero report', fakeAsync(() => {
      const financieroTipo = component.tiposInformes.find(t => t.id === 'financiero')!;
      
      component.generarInforme(financieroTipo);
      
      expect(console.log).toHaveBeenCalledWith('Generando informe: Reporte Financiero');
      
      tick(1500);
      
      expect(component.loading).toBe(false);
    }));

    it('should handle multiple report generations sequentially', fakeAsync(() => {
      // First report
      component.generarInforme(mockTipo);
      expect(component.loading).toBe(true);
      
      tick(1500);
      expect(component.loading).toBe(false);
      
      // Second report
      const otroTipo = component.tiposInformes.find(t => t.id === 'calificaciones')!;
      component.generarInforme(otroTipo);
      expect(component.loading).toBe(true);
      
      tick(1500);
      expect(component.loading).toBe(false);
    }));

    it('should not affect loading state before timeout completes', fakeAsync(() => {
      component.generarInforme(mockTipo);
      expect(component.loading).toBe(true);
      
      tick(1000); // Less than 1500ms
      expect(component.loading).toBe(true);
      
      tick(500); // Complete the remaining time
      expect(component.loading).toBe(false);
    }));
  });

  describe('goBack', () => {
    it('should navigate to admin dashboard', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
    });

    it('should call router.navigate exactly once', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('TipoInforme interface', () => {
    it('should have valid structure for all report types', () => {
      component.tiposInformes.forEach(tipo => {
        expect(typeof tipo.id).toBe('string');
        expect(typeof tipo.nombre).toBe('string');
        expect(typeof tipo.descripcion).toBe('string');
        expect(typeof tipo.icono).toBe('string');
        expect(tipo.id.length).toBeGreaterThan(0);
        expect(tipo.nombre.length).toBeGreaterThan(0);
        expect(tipo.descripcion.length).toBeGreaterThan(0);
        expect(tipo.icono.length).toBeGreaterThan(0);
      });
    });

    it('should have unique ids for all report types', () => {
      const ids = component.tiposInformes.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique names for all report types', () => {
      const nombres = component.tiposInformes.map(t => t.nombre);
      const uniqueNombres = new Set(nombres);
      expect(uniqueNombres.size).toBe(nombres.length);
    });
  });

  describe('component dependencies', () => {
    it('should have Router injected', () => {
      expect(mockRouter).toBeDefined();
    });

    it('should have ApiService injected', () => {
      expect(apiService).toBeDefined();
    });
  });

  describe('loading state management', () => {
    beforeEach(() => {
      jest.spyOn(window, 'alert').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();
    });

    it('should toggle loading state correctly', fakeAsync(() => {
      const mockTipo = component.tiposInformes[0];
      
      expect(component.loading).toBe(false);
      
      component.generarInforme(mockTipo);
      expect(component.loading).toBe(true);
      
      tick(1500);
      expect(component.loading).toBe(false);
    }));

    it('should not be loading initially', () => {
      expect(component.loading).toBe(false);
    });

    it('should reset loading after each report generation', fakeAsync(() => {
      const tipos = component.tiposInformes;
      
      tipos.forEach(tipo => {
        component.generarInforme(tipo);
        expect(component.loading).toBe(true);
        tick(1500);
        expect(component.loading).toBe(false);
      });
    }));
  });
});