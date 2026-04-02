import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import AttendanceComponent from './attendance';
import { ApiService } from '../../../services/api.service';

describe('AttendanceComponent', () => {
  let component: AttendanceComponent;
  let fixture: ComponentFixture<AttendanceComponent>;
  let apiService: any;

  const mockGroups = {
    success: true,
    groups: [
      { _id: '1', name: 'Matemáticas 10A', codigo: 'MAT10A', periodo: '1' },
      { _id: '2', name: 'Física 11B', codigo: 'FIS11B', periodo: '2' }
    ]
  };

  const mockStudents = {
    success: true,
    students: [
      { student_id: '1', student_code: 'EST001', student_name: 'Juan Pérez' },
      { student_id: '2', student_code: 'EST002', student_name: 'María García' }
    ]
  };

  const mockAttendance = {
    success: true,
    attendance: {
      registros: [
        {
          id_estudiante: '1',
          estado: 'presente',
          observaciones: 'Llegó a tiempo',
          estudiante_info: {
            codigo_est: 'EST001',
            nombres: 'Juan',
            apellidos: 'Pérez'
          }
        }
      ]
    }
  };

  beforeEach(async () => {
    const apiServiceMock = {
      getTeacherGroups: jest.fn().mockReturnValue(of(mockGroups)),
      getAttendance: jest.fn().mockReturnValue(of(mockAttendance)),
      getCourseGrades: jest.fn().mockReturnValue(of(mockStudents)),
      saveAttendance: jest.fn().mockReturnValue(of({ success: true, message: 'Asistencia guardada exitosamente' }))
    };

    await TestBed.configureTestingModule({
      imports: [
        AttendanceComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    fixture = TestBed.createComponent(AttendanceComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.grupos).toEqual([]);
    expect(component.grupoSeleccionado).toBeNull();
    expect(component.periodoSeleccionado).toBeNull();
    expect(component.estudiantes).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.saving).toBe(false);
    expect(component.error).toBeNull();
    expect(component.successMessage).toBeNull();
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
    expect(component.grupos[0].name).toBe('Matemáticas 10A');
  });

  it('should handle error when loading groups', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getTeacherGroups.mockReturnValue(
      throwError(() => new Error('Server error'))
    );
    fixture.detectChanges();
    expect(component.error).toBe('Error al cargar los grupos');
    expect(component.loading).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('should set periodoSeleccionado when grupo changes', () => {
    component.grupos = mockGroups.groups;
    component.grupoSeleccionado = component.grupos[0];
    const cargarEstudiantesSpy = jest.spyOn(component, 'cargarEstudiantes');
    
    component.onGrupoChange();
    
    expect(component.periodoSeleccionado).toBe('1');
    expect(cargarEstudiantesSpy).toHaveBeenCalled();
  });

  it('should load students when grupo is selected', () => {
    component.grupoSeleccionado = mockGroups.groups[0];
    component.cargarEstudiantes();
    
    expect(apiService.getAttendance).toHaveBeenCalled();
  });

  it('should load existing attendance when available', () => {
    component.grupoSeleccionado = mockGroups.groups[0];
    component.cargarEstudiantes();
    
    setTimeout(() => {
      expect(component.estudiantes.length).toBeGreaterThan(0);
    }, 100);
  });

  it('should load course students when no attendance exists', (done) => {
    apiService.getAttendance.mockReturnValue(of({ success: false }));
    component.grupoSeleccionado = mockGroups.groups[0];
    component.cargarEstudiantes();
    
    setTimeout(() => {
      expect(apiService.getCourseGrades).toHaveBeenCalled();
      done();
    }, 200);
  });

  it('should handle error when loading attendance', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getAttendance.mockReturnValue(
      throwError(() => new Error('Error'))
    );
    component.grupoSeleccionado = mockGroups.groups[0];
    component.cargarEstudiantes();
    
    setTimeout(() => {
      expect(apiService.getCourseGrades).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      done();
    }, 200);
  });

  it('should reload students when fecha changes', () => {
    component.grupoSeleccionado = mockGroups.groups[0];
    const cargarEstudiantesSpy = jest.spyOn(component, 'cargarEstudiantes');
    
    component.onFechaChange();
    
    expect(cargarEstudiantesSpy).toHaveBeenCalled();
  });

  it('should mark all students as presente', () => {
    component.estudiantes = [
      { id_estudiante: '1', codigo: 'EST001', nombre: 'Juan', estado: 'ausente' as const, observaciones: '' },
      { id_estudiante: '2', codigo: 'EST002', nombre: 'María', estado: 'tarde' as const, observaciones: '' }
    ];
    
    component.marcarTodos('presente');
    
    expect(component.estudiantes[0].estado).toBe('presente');
    expect(component.estudiantes[1].estado).toBe('presente');
  });

  it('should mark all students as ausente', () => {
    component.estudiantes = [
      { id_estudiante: '1', codigo: 'EST001', nombre: 'Juan', estado: 'presente' as const, observaciones: '' }
    ];
    
    component.marcarTodos('ausente');
    
    expect(component.estudiantes[0].estado).toBe('ausente');
  });

  it('should not save attendance without grupo seleccionado', () => {
    component.grupoSeleccionado = null;
    component.guardarAsistencia();
    
    expect(component.error).toBe('Selecciona un grupo y asegúrate de tener estudiantes listados');
    expect(apiService.saveAttendance).not.toHaveBeenCalled();
  });

  it('should not save attendance without estudiantes', () => {
    component.grupoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [];
    component.guardarAsistencia();
    
    expect(component.error).toBe('Selecciona un grupo y asegúrate de tener estudiantes listados');
    expect(apiService.saveAttendance).not.toHaveBeenCalled();
  });

  it('should save attendance successfully', (done) => {
    component.grupoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      { id_estudiante: '1', codigo: 'EST001', nombre: 'Juan', estado: 'presente' as const, observaciones: '' }
    ];
    
    component.guardarAsistencia();
    
    // API should be called
    expect(apiService.saveAttendance).toHaveBeenCalled();
    
    setTimeout(() => {
      expect(component.successMessage).toBeTruthy();
      expect(component.saving).toBe(false);
      done();
    }, 100);
  });

  it('should handle error when saving attendance', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.saveAttendance.mockReturnValue(
      throwError(() => ({ error: { error: 'Error guardando' } }))
    );
    
    component.grupoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      { id_estudiante: '1', codigo: 'EST001', nombre: 'Juan', estado: 'presente' as const, observaciones: '' }
    ];
    
    component.guardarAsistencia();
    
    setTimeout(() => {
      expect(component.error).toBe('Error guardando');
      expect(component.saving).toBe(false);
      consoleErrorSpy.mockRestore();
      done();
    }, 100);
  });

  it('should clear successMessage after 3 seconds', (done) => {
    component.grupoSeleccionado = mockGroups.groups[0];
    component.estudiantes = [
      { id_estudiante: '1', codigo: 'EST001', nombre: 'Juan', estado: 'presente' as const, observaciones: '' }
    ];
    component.guardarAsistencia();
    
    setTimeout(() => {
      expect(component.successMessage).toBeTruthy();
      setTimeout(() => {
        expect(component.successMessage).toBeNull();
        done();
      }, 3100);
    }, 100);
  }, 5000);

  it('should calculate resumen correctly', () => {
    component.estudiantes = [
      { id_estudiante: '1', codigo: 'EST001', nombre: 'Juan', estado: 'presente' as const, observaciones: '' },
      { id_estudiante: '2', codigo: 'EST002', nombre: 'María', estado: 'ausente' as const, observaciones: '' },
      { id_estudiante: '3', codigo: 'EST003', nombre: 'Pedro', estado: 'tarde' as const, observaciones: '' },
      { id_estudiante: '4', codigo: 'EST004', nombre: 'Ana', estado: 'excusa' as const, observaciones: '' }
    ];
    
    const resumen = component.getResumen();
    
    expect(resumen.presentes).toBe(1);
    expect(resumen.ausentes).toBe(1);
    expect(resumen.tardes).toBe(1);
    expect(resumen.excusas).toBe(1);
    expect(resumen.total).toBe(4);
  });
});
