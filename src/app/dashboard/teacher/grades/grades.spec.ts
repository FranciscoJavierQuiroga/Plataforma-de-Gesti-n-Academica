import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import GradesComponent from './grades';
import { ApiService } from '../../../services/api.service';

describe('GradesComponent', () => {
  let component: GradesComponent;
  let fixture: ComponentFixture<GradesComponent>;
  let apiService: any;
  let router: any;

  const mockGroups = {
    success: true,
    groups: [
      { _id: '1', name: 'Matemáticas 10A', codigo: 'MAT10A' },
      { _id: '2', name: 'Física 11B', codigo: 'FIS11B' }
    ]
  };

  const mockStudents = {
    success: true,
    students: [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan Pérez',
        student_code: 'EST001',
        grades: [
          { tipo: 'Parcial', nota: 4.5, nota_maxima: 5, peso: 0.33, fecha_eval: '2024-01-15' },
          { tipo: 'Taller', nota: 4.0, nota_maxima: 5, peso: 0.33, fecha_eval: '2024-02-15' }
        ],
        average: 4.25
      }
    ]
  };

  beforeEach(async () => {
    const apiServiceMock = {
      getTeacherGroups: jest.fn().mockReturnValue(of(mockGroups)),
      getCourseGrades: jest.fn().mockReturnValue(of(mockStudents)),
      bulkUploadGrades: jest.fn().mockReturnValue(of({ success: true, successful: 3, failed: 0 }))
    };

    const routerMock = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        GradesComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    router = TestBed.inject(Router);
    router.navigate = routerMock.navigate;

    fixture = TestBed.createComponent(GradesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.cursoSeleccionado).toBeNull();
    expect(component.periodoSeleccionado).toBe('1');
    expect(component.grupos).toEqual([]);
    expect(component.estudiantes).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.guardando).toBe(false);
    expect(component.error).toBeNull();
  });

  it('should call cargarGrupos on init', () => {
    const cargarGruposSpy = jest.spyOn(component, 'cargarGrupos');
    component.ngOnInit();
    expect(cargarGruposSpy).toHaveBeenCalled();
  });

  it('should load groups on init', () => {
    fixture.detectChanges();
    expect(apiService.getTeacherGroups).toHaveBeenCalled();
  });

  it('should populate groups when API succeeds', () => {
    fixture.detectChanges();
    expect(component.grupos.length).toBe(2);
  });

  it('should handle error when loading groups', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getTeacherGroups.mockReturnValue(
      throwError(() => new Error('Error'))
    );
    fixture.detectChanges();
    expect(component.error).toBe('Error al cargar grupos');
    expect(component.loading).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('should load calificaciones when curso is selected', () => {
    component.cursoSeleccionado = mockGroups.groups[0];
    const cargarCalificacionesSpy = jest.spyOn(component, 'cargarCalificaciones');
    
    component.onGrupoChange();
    
    expect(cargarCalificacionesSpy).toHaveBeenCalled();
  });

  it('should not load calificaciones without curso seleccionado', () => {
    component.cursoSeleccionado = null;
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    component.cargarCalificaciones();
    
    expect(apiService.getCourseGrades).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('should load students when cargarCalificaciones is called', () => {
    component.cursoSeleccionado = mockGroups.groups[0];
    component.cargarCalificaciones();
    
    expect(apiService.getCourseGrades).toHaveBeenCalled();
  });

  it('should map student data correctly', (done) => {
    component.cursoSeleccionado = mockGroups.groups[0];
    component.cargarCalificaciones();
    
    setTimeout(() => {
      expect(component.estudiantes.length).toBe(1);
      expect(component.estudiantes[0].student_name).toBe('Juan Pérez');
      expect(component.estudiantes[0].nota1).toBe(4.5);
      expect(component.estudiantes[0].nota2).toBe(4.0);
      done();
    }, 100);
  });

  it('should calculate promedios automatically', () => {
    component.estudiantes = [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan',
        student_code: 'EST001',
        grades: [],
        average: 0,
        nota1: 4.0,
        nota2: 4.5,
        nota3: 3.5
      }
    ];
    
    component.calcularPromediosAuto();
    
    // (4.0 + 4.5 + 3.5) / 3 = 4.0
    expect(component.estudiantes[0].average).toBe(4.0);
  });

  it('should not save with invalid grades (negative)', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    component.cursoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan',
        student_code: 'EST001',
        grades: [],
        average: 0,
        nota1: -1,
        nota2: 4.0
      }
    ];
    
    component.guardarCalificaciones();
    
    expect(alertSpy).toHaveBeenCalledWith('Error: Las notas deben estar entre 0.0 y 5.0');
    expect(apiService.bulkUploadGrades).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('should not save with invalid grades (over 5)', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    component.cursoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan',
        student_code: 'EST001',
        grades: [],
        average: 0,
        nota1: 6.0
      }
    ];
    
    component.guardarCalificaciones();
    
    expect(alertSpy).toHaveBeenCalledWith('Error: Las notas deben estar entre 0.0 y 5.0');
    alertSpy.mockRestore();
  });

  it('should save valid grades', (done) => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    component.cursoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan',
        student_code: 'EST001',
        grades: [],
        average: 0,
        nota1: 4.0,
        nota2: 4.5,
        observaciones: 'Buen trabajo'
      }
    ];
    
    component.guardarCalificaciones();
    
    setTimeout(() => {
      expect(apiService.bulkUploadGrades).toHaveBeenCalled();
      expect(component.guardando).toBe(false);
      alertSpy.mockRestore();
      done();
    }, 100);
  });

  it('should not save when no grades to upload', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    component.cursoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan',
        student_code: 'EST001',
        grades: [],
        average: 0
      }
    ];
    
    component.guardarCalificaciones();
    
    expect(alertSpy).toHaveBeenCalledWith('No hay calificaciones para guardar');
    expect(component.guardando).toBe(false);
    alertSpy.mockRestore();
  });

  it('should handle error when saving grades', (done) => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.bulkUploadGrades.mockReturnValue(
      throwError(() => new Error('Error'))
    );
    
    component.cursoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan',
        student_code: 'EST001',
        grades: [],
        average: 0,
        nota1: 4.0
      }
    ];
    
    component.guardarCalificaciones();
    
    setTimeout(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error al guardar calificaciones');
      expect(component.guardando).toBe(false);
      alertSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      done();
    }, 100);
  });

  it('should export PDF (placeholder)', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    component.exportarPDF();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('should navigate back to teacher dashboard', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/teacher']);
  });
});
