import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import GroupDetailComponent from './group-detail';
import { ApiService } from '../../../services/api.service';

describe('GroupDetailComponent', () => {
  let component: GroupDetailComponent;
  let fixture: ComponentFixture<GroupDetailComponent>;
  let apiService: any;
  let router: any;
  let activatedRoute: any;

  const mockGroup = {
    success: true,
    group: {
      _id: '1',
      nombre_curso: 'Matemáticas 10A',
      codigo_curso: 'MAT10A',
      grado: '10',
      periodo: '1',
      capacidad_max: 30,
      docente_info: {
        nombres: 'Carlos',
        apellidos: 'García',
        especialidad: 'Matemáticas'
      }
    }
  };

  const mockStudents = {
    success: true,
    students: [
      {
        enrollment_id: 'ENR1',
        student_id: 'ST1',
        student_name: 'Juan Pérez',
        student_code: 'EST001',
        average: 4.5,
        estado: 'activo',
        grades: [{ nota: 4.5 }]
      },
      {
        enrollment_id: 'ENR2',
        student_id: 'ST2',
        student_name: 'María García',
        student_code: 'EST002',
        average: 2.5,
        estado: 'activo',
        grades: [{ nota: 2.5 }]
      },
      {
        enrollment_id: 'ENR3',
        student_id: 'ST3',
        student_name: 'Pedro López',
        student_code: 'EST003',
        average: 0,
        estado: 'activo',
        grades: []
      }
    ]
  };

  beforeEach(async () => {
    const apiServiceMock = {
      getGroupById: jest.fn().mockReturnValue(of(mockGroup)),
      getCourseGrades: jest.fn().mockReturnValue(of(mockStudents))
    };

    const routerMock = {
      navigate: jest.fn()
    };

    activatedRoute = {
      snapshot: {
        paramMap: {
          get: jest.fn().mockReturnValue('1')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        GroupDetailComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRoute }
      ]
    }).compileComponents();

    apiService = TestBed.inject(ApiService);
    router = TestBed.inject(Router);
    router.navigate = routerMock.navigate;

    fixture = TestBed.createComponent(GroupDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.groupId).toBeNull();
    expect(component.group).toBeNull();
    expect(component.students).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
  });

  it('should get groupId from route on init', () => {
    component.ngOnInit();
    expect(component.groupId).toBe('1');
  });

  it('should load group details and students on init when groupId exists', () => {
    const loadGroupSpy = jest.spyOn(component, 'loadGroupDetails');
    const loadStudentsSpy = jest.spyOn(component, 'loadStudents');
    
    component.ngOnInit();
    
    expect(loadGroupSpy).toHaveBeenCalled();
    expect(loadStudentsSpy).toHaveBeenCalled();
  });

  it('should not load data when groupId is null', () => {
    activatedRoute.snapshot.paramMap.get.mockReturnValue(null);
    const loadGroupSpy = jest.spyOn(component, 'loadGroupDetails');
    const loadStudentsSpy = jest.spyOn(component, 'loadStudents');
    
    component.ngOnInit();
    
    expect(loadGroupSpy).not.toHaveBeenCalled();
    expect(loadStudentsSpy).not.toHaveBeenCalled();
  });

  it('should load group details', () => {
    component.groupId = '1';
    component.loadGroupDetails();
    
    expect(apiService.getGroupById).toHaveBeenCalledWith('1');
  });

  it('should populate group when API succeeds', (done) => {
    component.groupId = '1';
    component.loadGroupDetails();
    
    setTimeout(() => {
      expect(component.group).toBeTruthy();
      expect(component.group?.nombre_curso).toBe('Matemáticas 10A');
      expect(component.loading).toBe(false);
      done();
    }, 100);
  });

  it('should handle error when loading group', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getGroupById.mockReturnValue(
      throwError(() => new Error('Error'))
    );
    
    component.groupId = '1';
    component.loadGroupDetails();
    
    setTimeout(() => {
      expect(component.error).toBe('Error al cargar detalles del grupo');
      expect(component.loading).toBe(false);
      consoleErrorSpy.mockRestore();
      done();
    }, 100);
  });

  it('should not load group details without groupId', () => {
    component.groupId = null;
    component.loadGroupDetails();
    
    expect(apiService.getGroupById).not.toHaveBeenCalled();
  });

  it('should load students', () => {
    component.groupId = '1';
    component.loadStudents();
    
    expect(apiService.getCourseGrades).toHaveBeenCalledWith('1');
  });

  it('should populate students and calculate stats when API succeeds', (done) => {
    component.groupId = '1';
    component.loadStudents();
    
    setTimeout(() => {
      expect(component.students.length).toBe(3);
      expect(component.stats.total_students).toBe(3);
      expect(component.stats.aprobados).toBe(1); // Only Juan with 4.5 >= 3.0
      expect(component.stats.reprobados).toBe(1); // María with 2.5 < 3.0
      expect(component.stats.sin_notas).toBe(1); // Pedro with no grades
      expect(component.loading).toBe(false);
      done();
    }, 100);
  });

  it('should handle error when loading students', (done) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    apiService.getCourseGrades.mockReturnValue(
      throwError(() => new Error('Error'))
    );
    
    component.groupId = '1';
    component.loadStudents();
    
    setTimeout(() => {
      expect(component.error).toBe('Error al cargar estudiantes');
      expect(component.loading).toBe(false);
      consoleErrorSpy.mockRestore();
      done();
    }, 100);
  });

  it('should not load students without groupId', () => {
    component.groupId = null;
    component.loadStudents();
    
    expect(apiService.getCourseGrades).not.toHaveBeenCalled();
  });

  it('should calculate stats correctly', () => {
    component.students = mockStudents.students;
    component.calculateStats();
    
    expect(component.stats.total_students).toBe(3);
    expect(component.stats.aprobados).toBe(1);
    expect(component.stats.reprobados).toBe(1);
    expect(component.stats.sin_notas).toBe(1);
    // promedio_general: (4.5 + 2.5 + 0) / 3 = 2.33
    expect(component.stats.promedio_general).toBe(2.33);
  });

  it('should calculate promedio_general as 0 when no students', () => {
    component.students = [];
    component.calculateStats();
    
    expect(component.stats.promedio_general).toBe(0);
  });

  it('should navigate to grades', () => {
    component.goToGrades();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/teacher/grades']);
  });

  it('should navigate to attendance', () => {
    component.goToAttendance();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/teacher/attendance']);
  });

  it('should navigate back to teacher dashboard', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/teacher']);
  });

  it('should show alert when viewing student detail', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
    const student = mockStudents.students[0];
    
    component.viewStudentDetail(student);
    
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Vista detallada del estudiante: Juan Pérez')
    );
    alertSpy.mockRestore();
  });
});
