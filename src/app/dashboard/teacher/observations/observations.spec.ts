import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import ObservationsComponent from './observations';
import { ApiService } from '../../../services/api.service';

describe('ObservationsComponent', () => {
  let component: ObservationsComponent;
  let fixture: ComponentFixture<ObservationsComponent>;
  let apiService: any;
  let router: any;

  const mockGroups = {
    success: true,
    groups: [
      { _id: '1', name: 'Matemáticas 10A', codigo: 'MAT10A' }
    ]
  };

  const mockObservations = {
    success: true,
    observations: [
      {
        _id: '1',
        fecha: '2024-01-15',
        estudiante_info: {
          nombres: 'Juan',
          apellidos: 'Pérez',
          codigo_est: 'EST001'
        },
        curso_info: {
          nombre_curso: 'Matemáticas',
          codigo_curso: 'MAT10A',
          grado: '10'
        },
        tipo: 'positiva',
        categoria: 'academica',
        descripcion: 'Excelente trabajo',
        seguimiento: 'Continúa así',
        docente_info: {
          nombres: 'Carlos',
          apellidos: 'García'
        }
      },
      {
        _id: '2',
        fecha: '2024-01-16',
        estudiante_info: {
          nombres: 'María',
          apellidos: 'García',
          codigo_est: 'EST002'
        },
        curso_info: {
          nombre_curso: 'Matemáticas',
          codigo_curso: 'MAT10A',
          grado: '10'
        },
        tipo: 'negativa',
        categoria: 'comportamiento',
        descripcion: 'Falta de atención',
        seguimiento: 'Mejorar',
        docente_info: {
          nombres: 'Carlos',
          apellidos: 'García'
        },
        gravedad: 'leve'
      }
    ],
    statistics: {
      total: 2,
      positivas: 1,
      negativas: 1,
      neutrales: 0
    }
  };

  const mockStudents = {
    success: true,
    students: [
      { student_id: 'ST1', student_name: 'Juan Pérez', student_code: 'EST001' }
    ]
  };

  beforeEach(async () => {
    const apiServiceMock = {
      getTeacherGroups: jest.fn().mockReturnValue(of(mockGroups)),
      getObservations: jest.fn().mockReturnValue(of(mockObservations)),
      getCourseGrades: jest.fn().mockReturnValue(of(mockStudents)),
      createObservation: jest.fn().mockReturnValue(of({ success: true })),
      updateObservation: jest.fn().mockReturnValue(of({ success: true })),
      deleteObservation: jest.fn().mockReturnValue(of({ success: true }))
    };

    const routerMock = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        ObservationsComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    router = TestBed.inject(Router);
    router.navigate = routerMock.navigate;

    fixture = TestBed.createComponent(ObservationsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.observaciones).toEqual([]);
    expect(component.observacionesFiltradas).toEqual([]);
    expect(component.grupos).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    expect(component.showModal).toBe(false);
    expect(component.editandoId).toBeNull();
  });

  it('should call cargarGrupos and cargarObservaciones on init', () => {
    const cargarGruposSpy = jest.spyOn(component, 'cargarGrupos');
    const cargarObservacionesSpy = jest.spyOn(component, 'cargarObservaciones');
    
    component.ngOnInit();
    
    expect(cargarGruposSpy).toHaveBeenCalled();
    expect(cargarObservacionesSpy).toHaveBeenCalled();
  });

  it('should load groups on init', () => {
    fixture.detectChanges();
    expect(apiService.getTeacherGroups).toHaveBeenCalled();
  });

  it('should populate groups when API succeeds', (done) => {
    fixture.detectChanges();
    setTimeout(() => {
      expect(component.grupos.length).toBe(1);
      done();
    }, 100);
  });

  it('should load observations on init', () => {
    fixture.detectChanges();
    expect(apiService.getObservations).toHaveBeenCalled();
  });

  it('should populate observations and resumen when API succeeds', (done) => {
    fixture.detectChanges();
    setTimeout(() => {
      expect(component.observaciones.length).toBe(2);
      expect(component.resumen.total).toBe(2);
      expect(component.resumen.positivas).toBe(1);
      expect(component.resumen.negativas).toBe(1);
      done();
    }, 100);
  });

  it('should handle error when loading observations', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getObservations.mockReturnValue(
      throwError(() => new Error('Error'))
    );
    
    component.cargarObservaciones();
    
    setTimeout(() => {
      expect(component.error).toBe('Error al cargar observaciones');
      expect(component.loading).toBe(false);
      consoleErrorSpy.mockRestore();
      done();
    }, 100);
  });

  it('should apply filters when cargarObservaciones is called', () => {
    component.filtros.tipo = 'positiva';
    component.filtros.grupo = '1';
    component.filtros.categoria = 'academica';
    
    component.cargarObservaciones();
    
    expect(apiService.getObservations).toHaveBeenCalledWith({
      tipo: 'positiva',
      course_id: '1',
      categoria: 'academica'
    });
  });

  it('should apply text filter', () => {
    component.observaciones = mockObservations.observations;
    component.filtros.texto = 'Juan';
    
    component.aplicarFiltroTexto();
    
    expect(component.observacionesFiltradas.length).toBe(1);
    expect(component.observacionesFiltradas[0].estudiante_info.nombres).toBe('Juan');
  });

  it('should show all observations when text filter is empty', () => {
    component.observaciones = mockObservations.observations;
    component.filtros.texto = '';
    
    component.aplicarFiltroTexto();
    
    expect(component.observacionesFiltradas.length).toBe(2);
  });

  it('should load students when grupo changes', () => {
    component.filtros.grupo = '1';
    component.onGrupoChange();
    
    expect(apiService.getCourseGrades).toHaveBeenCalledWith('1');
  });

  it('should not load students when grupo is todos', () => {
    component.filtros.grupo = 'todos';
    component.onGrupoChange();
    
    expect(apiService.getCourseGrades).not.toHaveBeenCalled();
  });

  it('should open modal for new observation', () => {
    component.nuevaObservacion();
    
    expect(component.showModal).toBe(true);
    expect(component.editandoId).toBeNull();
    expect(component.nuevaObs.descripcion).toBe('');
  });

  it('should open modal for editing observation', () => {
    const obs = mockObservations.observations[0];
    component.editar(obs);
    
    expect(component.showModal).toBe(true);
    expect(component.editandoId).toBe('1');
    expect(component.nuevaObs.tipo).toBe('positiva');
    expect(component.nuevaObs.descripcion).toBe('Excelente trabajo');
  });

  it('should not save observation with missing required fields', () => {
    component.nuevaObs.descripcion = '';
    component.guardarObservacion();
    
    expect(component.error).toBe('Completa todos los campos obligatorios');
    expect(apiService.createObservation).not.toHaveBeenCalled();
  });

  it('should create new observation successfully', (done) => {
    component.nuevaObs = {
      student_id: 'ST1',
      course_id: '1',
      tipo: 'positiva',
      categoria: 'academica',
      descripcion: 'Buen trabajo',
      seguimiento: 'Continúa',
      gravedad: 'leve',
      notificado_acudiente: false
    };
    
    component.guardarObservacion();
    
    setTimeout(() => {
      expect(apiService.createObservation).toHaveBeenCalled();
      expect(component.successMessage).toBe('Observación creada exitosamente');
      expect(component.showModal).toBe(false);
      done();
    }, 100);
  });

  it('should update existing observation successfully', (done) => {
    component.editandoId = '1';
    component.nuevaObs = {
      student_id: 'ST1',
      course_id: '1',
      tipo: 'positiva',
      categoria: 'academica',
      descripcion: 'Actualizado',
      seguimiento: 'Nuevo seguimiento',
      gravedad: 'leve',
      notificado_acudiente: false
    };
    
    component.guardarObservacion();
    
    setTimeout(() => {
      expect(apiService.updateObservation).toHaveBeenCalledWith('1', component.nuevaObs);
      expect(component.successMessage).toBe('Observación actualizada exitosamente');
      expect(component.showModal).toBe(false);
      done();
    }, 100);
  });

  it('should handle error when creating observation', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.createObservation.mockReturnValue(
      throwError(() => ({ error: { error: 'Error creating' } }))
    );
    
    component.nuevaObs = {
      student_id: 'ST1',
      course_id: '1',
      tipo: 'positiva',
      categoria: 'academica',
      descripcion: 'Test',
      seguimiento: '',
      gravedad: 'leve',
      notificado_acudiente: false
    };
    
    component.guardarObservacion();
    
    setTimeout(() => {
      expect(component.error).toBe('Error creating');
      expect(component.loading).toBe(false);
      consoleErrorSpy.mockRestore();
      done();
    }, 100);
  });

  it('should delete observation when confirmed', (done) => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const obs = mockObservations.observations[0];
    
    component.eliminar(obs);
    
    setTimeout(() => {
      expect(apiService.deleteObservation).toHaveBeenCalledWith('1');
      expect(component.successMessage).toBe('Observación eliminada exitosamente');
      confirmSpy.mockRestore();
      done();
    }, 100);
  });

  it('should not delete observation when cancelled', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const obs = mockObservations.observations[0];
    
    component.eliminar(obs);
    
    expect(apiService.deleteObservation).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('should close modal', () => {
    component.showModal = true;
    component.editandoId = '1';
    
    component.cerrarModal();
    
    expect(component.showModal).toBe(false);
    expect(component.editandoId).toBeNull();
  });

  it('should get student name correctly', () => {
    const obs = mockObservations.observations[0];
    const nombre = component.getEstudianteNombre(obs);
    
    expect(nombre).toBe('Juan Pérez');
  });

  it('should get grupo nombre correctly', () => {
    const obs = mockObservations.observations[0];
    const nombre = component.getGrupoNombre(obs);
    
    expect(nombre).toBe('10° MAT10A');
  });

  it('should get docente nombre correctly', () => {
    const obs = mockObservations.observations[0];
    const nombre = component.getDocenteNombre(obs);
    
    expect(nombre).toBe('Carlos García');
  });

  it('should format fecha correctly', () => {
    const fecha = component.formatFecha('2024-01-15');
    // Format depends on locale, but should be a date string
    expect(fecha).toBeTruthy();
    expect(typeof fecha).toBe('string');
  });

  it('should clear successMessage after 3 seconds', (done) => {
    component.nuevaObs = {
      student_id: 'ST1',
      course_id: '1',
      tipo: 'positiva',
      categoria: 'academica',
      descripcion: 'Test',
      seguimiento: '',
      gravedad: 'leve',
      notificado_acudiente: false
    };
    component.guardarObservacion();
    
    setTimeout(() => {
      expect(component.successMessage).toBeTruthy();
      setTimeout(() => {
        expect(component.successMessage).toBeNull();
        done();
      }, 3100);
    }, 100);
  }, 5000);
});
