import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EnrollmentFormComponent } from './enrollment-form';
import { ApiService } from '../../../services/api.service';
import { of, throwError } from 'rxjs';

describe('EnrollmentFormComponent', () => {
  let component: EnrollmentFormComponent;
  let fixture: ComponentFixture<EnrollmentFormComponent>;
  let apiService: ApiService;
  let mockRouter: any;
  let mockActivatedRoute: any;

  const mockStudents = [
    {
      _id: '1',
      nombres: 'Juan',
      apellidos: 'Pérez',
      codigo_est: 'EST001',
      documento: '123456789'
    },
    {
      _id: '2',
      nombres: 'María',
      apellidos: 'García',
      codigo_est: 'EST002',
      documento: '987654321'
    }
  ];

  const mockCourses = [
    {
      _id: 'c1',
      nombre_curso: 'Matemáticas',
      codigo_curso: 'MATH101',
      grado: '10°'
    },
    {
      _id: 'c2',
      nombre_curso: 'Física',
      codigo_curso: 'PHYS101',
      grado: '11°'
    }
  ];

  beforeEach(async () => {
    mockRouter = {
      navigate: jest.fn()
    };

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jest.fn()
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        EnrollmentFormComponent,
        HttpClientTestingModule,
        FormsModule,
        CommonModule
      ],
      providers: [
        ApiService,
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EnrollmentFormComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load students and courses on init', () => {
      jest.spyOn(component, 'loadStudents');
      jest.spyOn(component, 'loadCourses');

      component.ngOnInit();

      expect(component.loadStudents).toHaveBeenCalled();
      expect(component.loadCourses).toHaveBeenCalled();
    });
  });

  describe('loadStudents', () => {
    it('should load students successfully', () => {
      const mockResponse = {
        success: true,
        students: mockStudents
      };

      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(of(mockResponse));

      component.loadStudents();

      expect(apiService.getAdminStudents).toHaveBeenCalledWith({ estado: 'activo' });
      expect(component.students).toEqual(mockStudents);
      expect(component.filteredStudents).toEqual(mockStudents);
      expect(component.loading).toBe(false);
    });

    it('should handle error when loading students', () => {
      const mockError = { error: 'Failed to load' };
      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.loadStudents();

      expect(component.error).toBe('Error al cargar la lista de estudiantes');
      expect(component.loading).toBe(false);
    });

    it('should handle response without success flag', () => {
      const mockResponse = { success: false };
      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(of(mockResponse));

      component.loadStudents();

      expect(component.loading).toBe(false);
    });
  });

  describe('loadCourses', () => {
    it('should load courses successfully', () => {
      const mockResponse = {
        success: true,
        courses: mockCourses
      };

      jest.spyOn(apiService, 'getAdminCourses').mockReturnValue(of(mockResponse));

      component.loadCourses();

      expect(apiService.getAdminCourses).toHaveBeenCalledWith({ estado: 'activo' });
      expect(component.courses).toEqual(mockCourses);
      expect(component.filteredCourses).toEqual(mockCourses);
    });

    it('should handle error when loading courses', () => {
      const mockError = { error: 'Failed to load' };
      jest.spyOn(apiService, 'getAdminCourses').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.loadCourses();

      expect(component.error).toBe('Error al cargar la lista de cursos');
    });
  });

  describe('filterStudents', () => {
    beforeEach(() => {
      component.students = mockStudents;
      component.filteredStudents = mockStudents;
    });

    it('should show all students when search is empty', () => {
      component.searchStudent = '';
      component.filterStudents();

      expect(component.filteredStudents).toEqual(mockStudents);
    });

    it('should filter by first name', () => {
      component.searchStudent = 'Juan';
      component.filterStudents();

      expect(component.filteredStudents.length).toBe(1);
      expect(component.filteredStudents[0].nombres).toBe('Juan');
    });

    it('should filter by last name', () => {
      component.searchStudent = 'García';
      component.filterStudents();

      expect(component.filteredStudents.length).toBe(1);
      expect(component.filteredStudents[0].apellidos).toBe('García');
    });

    it('should filter by student code', () => {
      component.searchStudent = 'EST001';
      component.filterStudents();

      expect(component.filteredStudents.length).toBe(1);
      expect(component.filteredStudents[0].codigo_est).toBe('EST001');
    });

    it('should filter by document', () => {
      component.searchStudent = '123456789';
      component.filterStudents();

      expect(component.filteredStudents.length).toBe(1);
      expect(component.filteredStudents[0].documento).toBe('123456789');
    });

    it('should be case insensitive', () => {
      component.searchStudent = 'JUAN';
      component.filterStudents();

      expect(component.filteredStudents.length).toBe(1);
    });

    it('should return empty array if no matches', () => {
      component.searchStudent = 'NoExiste';
      component.filterStudents();

      expect(component.filteredStudents.length).toBe(0);
    });
  });

  describe('filterCourses', () => {
    beforeEach(() => {
      component.courses = mockCourses;
      component.filteredCourses = mockCourses;
    });

    it('should show all courses when search is empty', () => {
      component.searchCourse = '';
      component.filterCourses();

      expect(component.filteredCourses).toEqual(mockCourses);
    });

    it('should filter by course name', () => {
      component.searchCourse = 'Matemáticas';
      component.filterCourses();

      expect(component.filteredCourses.length).toBe(1);
      expect(component.filteredCourses[0].nombre_curso).toBe('Matemáticas');
    });

    it('should filter by course code', () => {
      component.searchCourse = 'MATH101';
      component.filterCourses();

      expect(component.filteredCourses.length).toBe(1);
      expect(component.filteredCourses[0].codigo_curso).toBe('MATH101');
    });

    it('should filter by grade', () => {
      component.searchCourse = '10°';
      component.filterCourses();

      expect(component.filteredCourses.length).toBe(1);
      expect(component.filteredCourses[0].grado).toBe('10°');
    });

    it('should be case insensitive', () => {
      component.searchCourse = 'MATEMÁTICAS';
      component.filterCourses();

      expect(component.filteredCourses.length).toBe(1);
    });
  });

  describe('getStudentName', () => {
    beforeEach(() => {
      component.students = mockStudents;
    });

    it('should return formatted student name', () => {
      const name = component.getStudentName('1');
      expect(name).toBe('Juan Pérez (EST001)');
    });

    it('should return default text if student not found', () => {
      const name = component.getStudentName('999');
      expect(name).toBe('Seleccione un estudiante');
    });
  });

  describe('getCourseName', () => {
    beforeEach(() => {
      component.courses = mockCourses;
    });

    it('should return formatted course name', () => {
      const name = component.getCourseName('c1');
      expect(name).toBe('Matemáticas (MATH101) - Grado 10°');
    });

    it('should return default text if course not found', () => {
      const name = component.getCourseName('999');
      expect(name).toBe('Seleccione un curso');
    });
  });

  describe('validateForm', () => {
    it('should return false if student_id is empty', () => {
      component.formData.student_id = '';
      component.formData.course_id = 'c1';
      component.formData.periodo = '1';

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('Por favor seleccione un estudiante');
    });

    it('should return false if course_id is empty', () => {
      component.formData.student_id = '1';
      component.formData.course_id = '';
      component.formData.periodo = '1';

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('Por favor seleccione un curso');
    });

    it('should return false if periodo is empty', () => {
      component.formData.student_id = '1';
      component.formData.course_id = 'c1';
      component.formData.periodo = '';

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('Por favor seleccione un periodo');
    });

    it('should return true if all required fields are filled', () => {
      component.formData = {
        student_id: '1',
        course_id: 'c1',
        periodo: '1',
        estado: 'pendiente',
        observaciones: ''
      };

      const result = component.validateForm();

      expect(result).toBe(true);
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      component.formData = {
        student_id: '1',
        course_id: 'c1',
        periodo: '1',
        estado: 'pendiente',
        observaciones: 'Test'
      };
    });

    it('should not submit if validation fails', () => {
      component.formData.student_id = '';
      jest.spyOn(apiService, 'createEnrollment');

      component.onSubmit();

      expect(apiService.createEnrollment).not.toHaveBeenCalled();
    });

    it('should create enrollment successfully', fakeAsync(() => {
      const mockResponse = { success: true, enrollment: { id: 1 } };
      jest.spyOn(apiService, 'createEnrollment').mockReturnValue(of(mockResponse));

      component.onSubmit();
      tick();

      expect(apiService.createEnrollment).toHaveBeenCalledWith(component.formData);
      expect(component.success).toBe('Matrícula creada exitosamente');
      expect(component.loading).toBe(false);
    }));

    it('should navigate after successful creation', fakeAsync(() => {
      const mockResponse = { success: true };
      jest.spyOn(apiService, 'createEnrollment').mockReturnValue(of(mockResponse));

      component.onSubmit();
      tick(1600);

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/dashboard/admin'],
        { queryParams: { view: 'enrollments' } }
      );
    }));

    it('should handle error when creating enrollment', () => {
      const mockError = { error: { error: 'Enrollment failed' } };
      jest.spyOn(apiService, 'createEnrollment').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.onSubmit();

      expect(component.error).toBe('Enrollment failed');
      expect(component.loading).toBe(false);
    });

    it('should use default error message if none provided', () => {
      const mockError = { error: {} };
      jest.spyOn(apiService, 'createEnrollment').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.onSubmit();

      expect(component.error).toBe('Error al crear la matrícula');
    });

    it('should clear previous errors before submitting', () => {
      component.error = 'Previous error';
      component.success = 'Previous success';
      const mockResponse = { success: true };
      jest.spyOn(apiService, 'createEnrollment').mockReturnValue(of(mockResponse));

      component.onSubmit();

      expect(component.error).toBeNull();
    });
  });

  describe('goBack', () => {
    it('should navigate to admin dashboard with enrollments view', () => {
      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/dashboard/admin'],
        { queryParams: { view: 'enrollments' } }
      );
    });
  });

  describe('resetForm', () => {
    it('should reset all form fields to default values', () => {
      component.students = mockStudents;
      component.courses = mockCourses;
      component.formData = {
        student_id: '1',
        course_id: 'c1',
        periodo: '2',
        estado: 'aprobado',
        observaciones: 'Test'
      };
      component.searchStudent = 'Juan';
      component.searchCourse = 'Math';
      component.error = 'Some error';
      component.success = 'Some success';

      component.resetForm();

      expect(component.formData.student_id).toBe('');
      expect(component.formData.course_id).toBe('');
      expect(component.formData.periodo).toBe('1');
      expect(component.formData.estado).toBe('pendiente');
      expect(component.formData.observaciones).toBe('');
      expect(component.searchStudent).toBe('');
      expect(component.searchCourse).toBe('');
      expect(component.filteredStudents).toEqual(mockStudents);
      expect(component.filteredCourses).toEqual(mockCourses);
      expect(component.error).toBeNull();
      expect(component.success).toBeNull();
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
      expect(component.success).toBeNull();
      expect(component.students).toEqual([]);
      expect(component.courses).toEqual([]);
      expect(component.filteredStudents).toEqual([]);
      expect(component.filteredCourses).toEqual([]);
      expect(component.searchStudent).toBe('');
      expect(component.searchCourse).toBe('');
    });

    it('should have default form data', () => {
      expect(component.formData.student_id).toBe('');
      expect(component.formData.course_id).toBe('');
      expect(component.formData.periodo).toBe('1');
      expect(component.formData.estado).toBe('pendiente');
      expect(component.formData.observaciones).toBe('');
    });

    it('should have periodos array with 4 periods', () => {
      expect(component.periodos.length).toBe(4);
      expect(component.periodos).toEqual(['1', '2', '3', '4']);
    });

    it('should have estados array with 5 states', () => {
      expect(component.estados.length).toBe(5);
      expect(component.estados[0].value).toBe('pendiente');
      expect(component.estados[1].value).toBe('aprobado');
      expect(component.estados[2].value).toBe('activo');
      expect(component.estados[3].value).toBe('rechazado');
      expect(component.estados[4].value).toBe('cancelado');
    });
  });
});