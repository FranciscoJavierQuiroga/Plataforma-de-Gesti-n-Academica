import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CourseFormComponent } from './course-form';
import { ApiService } from '../../../services/api.service';
import { of, throwError } from 'rxjs';

describe('CourseFormComponent', () => {
  let component: CourseFormComponent;
  let fixture: ComponentFixture<CourseFormComponent>;
  let apiService: ApiService;
  let mockRouter: any;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockRouter = {
      navigate: jest.fn()
    };

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jest.fn().mockReturnValue(null)
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [
        CourseFormComponent,
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

    fixture = TestBed.createComponent(CourseFormComponent);
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
    it('should load teachers on init', () => {
      const mockTeachers = {
        teachers: [
          { id: 1, nombre: 'Teacher 1' },
          { id: 2, nombre: 'Teacher 2' }
        ]
      };

      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(of(mockTeachers));

      component.ngOnInit();

      expect(apiService.getAdminTeachers).toHaveBeenCalledWith({ estado: 'activo' });
      expect(component.teachers).toEqual(mockTeachers.teachers);
    });

    it('should set isEdit to false when no id in route', () => {
      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(of({ teachers: [] }));

      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.courseId).toBeNull();
    });

    it('should set isEdit to true and load course data when id exists', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('123');
      
      const mockCourse = {
        success: true,
        course: {
          nombre_curso: 'Math 101',
          codigo_curso: 'MATH101',
          grado: '10°',
          periodo: '2024-1',
          descripcion: 'Advanced Math',
          creditos: 3,
          intensidad_horaria: 4,
          id_docente: '5',
          activo: true
        }
      };

      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(of({ teachers: [] }));
      jest.spyOn(apiService, 'getCourseDetail').mockReturnValue(of(mockCourse));

      component.ngOnInit();

      expect(component.isEdit).toBe(true);
      expect(component.courseId).toBe('123');
      expect(apiService.getCourseDetail).toHaveBeenCalledWith('123');
    });
  });

  describe('loadTeachers', () => {
    it('should set loading state correctly', () => {
      const mockTeachers = { teachers: [] };
      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(of(mockTeachers));

      expect(component.loadingTeachers).toBe(false);
      component.loadTeachers();
      expect(component.loadingTeachers).toBe(false);
    });

    it('should populate teachers array on success', () => {
      const mockTeachers = {
        teachers: [
          { id: 1, nombre: 'Teacher 1' },
          { id: 2, nombre: 'Teacher 2' }
        ]
      };

      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(of(mockTeachers));

      component.loadTeachers();

      expect(component.teachers).toEqual(mockTeachers.teachers);
    });

    it('should handle empty teachers response', () => {
      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(of({}));

      component.loadTeachers();

      expect(component.teachers).toEqual([]);
    });

    it('should handle error when loading teachers', () => {
      const mockError = { error: 'Failed to load teachers' };
      jest.spyOn(apiService, 'getAdminTeachers').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.loadTeachers();

      expect(component.loadingTeachers).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('loadCourseData', () => {
    it('should not load if courseId is null', () => {
      component.courseId = null;
      jest.spyOn(apiService, 'getCourseDetail');

      component.loadCourseData();

      expect(apiService.getCourseDetail).not.toHaveBeenCalled();
    });

    it('should load and populate form data', () => {
      component.courseId = '123';
      const mockCourse = {
        success: true,
        course: {
          nombre_curso: 'Math 101',
          codigo_curso: 'MATH101',
          grado: '10°',
          periodo: '2024-1',
          descripcion: 'Advanced Math',
          creditos: 3,
          intensidad_horaria: 4,
          id_docente: '5',
          activo: true
        }
      };

      jest.spyOn(apiService, 'getCourseDetail').mockReturnValue(of(mockCourse));

      component.loadCourseData();

      expect(component.formData.nombre_curso).toBe('Math 101');
      expect(component.formData.codigo_curso).toBe('MATH101');
      expect(component.formData.grado).toBe('10°');
      expect(component.formData.periodo).toBe('2024-1');
      expect(component.formData.creditos).toBe(3);
      expect(component.formData.intensidad_horaria).toBe(4);
      expect(component.formData.teacher_id).toBe('5');
      expect(component.formData.activo).toBe(true);
    });

    it('should handle error when loading course data', () => {
      component.courseId = '123';
      const mockError = { error: 'Not found' };
      jest.spyOn(apiService, 'getCourseDetail').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.loadCourseData();

      expect(component.error).toBe('Error al cargar los datos del curso');
      expect(component.loading).toBe(false);
    });
  });

  describe('validateForm', () => {
    it('should return false if nombre_curso is empty', () => {
      component.formData.nombre_curso = '';
      component.formData.codigo_curso = 'MATH101';
      component.formData.grado = '10°';
      component.formData.periodo = '2024-1';

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should return false if codigo_curso is empty', () => {
      component.formData.nombre_curso = 'Math';
      component.formData.codigo_curso = '';
      component.formData.grado = '10°';
      component.formData.periodo = '2024-1';

      const result = component.validateForm();

      expect(result).toBe(false);
    });

    it('should return false if creditos is less than 1', () => {
      component.formData.nombre_curso = 'Math';
      component.formData.codigo_curso = 'MATH101';
      component.formData.grado = '10°';
      component.formData.periodo = '2024-1';
      component.formData.creditos = 0;

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('Los créditos deben estar entre 1 y 10');
    });

    it('should return false if creditos is greater than 10', () => {
      component.formData.nombre_curso = 'Math';
      component.formData.codigo_curso = 'MATH101';
      component.formData.grado = '10°';
      component.formData.periodo = '2024-1';
      component.formData.creditos = 11;

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('Los créditos deben estar entre 1 y 10');
    });

    it('should return false if intensidad_horaria is less than 1', () => {
      component.formData.nombre_curso = 'Math';
      component.formData.codigo_curso = 'MATH101';
      component.formData.grado = '10°';
      component.formData.periodo = '2024-1';
      component.formData.intensidad_horaria = 0;

      const result = component.validateForm();

      expect(result).toBe(false);
      expect(component.error).toBe('La intensidad horaria debe estar entre 1 y 10 horas');
    });

    it('should return false if intensidad_horaria is greater than 10', () => {
      component.formData.nombre_curso = 'Math';
      component.formData.codigo_curso = 'MATH101';
      component.formData.grado = '10°';
      component.formData.periodo = '2024-1';
      component.formData.intensidad_horaria = 11;

      const result = component.validateForm();

      expect(result).toBe(false);
    });

    it('should return true if all validations pass', () => {
      component.formData = {
        nombre_curso: 'Math',
        codigo_curso: 'MATH101',
        grado: '10°',
        periodo: '1',
        descripcion: 'Test',
        creditos: 3,
        intensidad_horaria: 4,
        teacher_id: '1',
        activo: true
      };

      const result = component.validateForm();

      expect(result).toBe(true);
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      component.formData = {
        nombre_curso: 'Math',
        codigo_curso: 'MATH101',
        grado: '10°',
        periodo: '2024-1',
        descripcion: 'Test',
        creditos: 3,
        intensidad_horaria: 4,
        teacher_id: '1',
        activo: true
      };
    });

    it('should not submit if validation fails', () => {
      component.formData.nombre_curso = '';
      jest.spyOn(apiService, 'createCourse');

      component.onSubmit();

      expect(apiService.createCourse).not.toHaveBeenCalled();
    });

    it('should create new course when not in edit mode', fakeAsync(() => {
      component.isEdit = false;
      component.courseId = null;
      const mockResponse = { success: true, course: { id: 1 } };

      jest.spyOn(apiService, 'createCourse').mockReturnValue(of(mockResponse));

      component.onSubmit();
      tick();

      expect(apiService.createCourse).toHaveBeenCalledWith(component.formData);
      expect(component.success).toBe('Curso creado exitosamente');
      expect(component.loading).toBe(false);
    }));

    it('should navigate after successful creation', fakeAsync(() => {
      component.isEdit = false;
      const mockResponse = { success: true };

      jest.spyOn(apiService, 'createCourse').mockReturnValue(of(mockResponse));

      component.onSubmit();
      tick(1600);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
    }));

    it('should update existing course when in edit mode', fakeAsync(() => {
      component.isEdit = true;
      component.courseId = '123';
      const mockResponse = { success: true };

      jest.spyOn(apiService, 'updateCourse').mockReturnValue(of(mockResponse));

      component.onSubmit();
      tick();

      expect(apiService.updateCourse).toHaveBeenCalledWith('123', component.formData);
      expect(component.success).toBe('Curso actualizado exitosamente');
    }));

    it('should handle error when creating course', () => {
      component.isEdit = false;
      const mockError = { error: { error: 'Creation failed' } };

      jest.spyOn(apiService, 'createCourse').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.onSubmit();

      expect(component.error).toBe('Creation failed');
      expect(component.loading).toBe(false);
    });

    it('should handle error when updating course', () => {
      component.isEdit = true;
      component.courseId = '123';
      const mockError = { error: { error: 'Update failed' } };

      jest.spyOn(apiService, 'updateCourse').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.onSubmit();

      expect(component.error).toBe('Update failed');
      expect(component.loading).toBe(false);
    });

    it('should use default error message if none provided', () => {
      component.isEdit = false;
      const mockError = { error: {} };

      jest.spyOn(apiService, 'createCourse').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.onSubmit();

      expect(component.error).toBe('Error al crear el curso');
    });
  });

  describe('goBack', () => {
    it('should navigate to admin dashboard', () => {
      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
    });
  });

  describe('resetForm', () => {
    it('should reset all form fields to default values', () => {
      component.formData = {
        nombre_curso: 'Test',
        codigo_curso: 'TEST123',
        grado: '10°',
        periodo: '2024-1',
        descripcion: 'Description',
        creditos: 5,
        intensidad_horaria: 6,
        teacher_id: '10',
        activo: false
      };
      component.error = 'Some error';
      component.success = 'Some success';

      component.resetForm();

      expect(component.formData.nombre_curso).toBe('');
      expect(component.formData.codigo_curso).toBe('');
      expect(component.formData.grado).toBe('');
      expect(component.formData.periodo).toBe('');
      expect(component.formData.descripcion).toBe('');
      expect(component.formData.creditos).toBe(1);
      expect(component.formData.intensidad_horaria).toBe(2);
      expect(component.formData.teacher_id).toBe('');
      expect(component.formData.activo).toBe(true);
      expect(component.error).toBeNull();
      expect(component.success).toBeNull();
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(component.isEdit).toBe(false);
      expect(component.courseId).toBeNull();
      expect(component.loading).toBe(false);
      expect(component.loadingTeachers).toBe(false);
      expect(component.error).toBeNull();
      expect(component.success).toBeNull();
      expect(component.teachers).toEqual([]);
    });

    it('should have grados array with 11 grades', () => {
      expect(component.grados.length).toBe(11);
      expect(component.grados[0]).toBe('1°');
      expect(component.grados[10]).toBe('11°');
    });

    it('should have periodos array', () => {
  expect(component.periodos.length).toBe(4); // ✅ CAMBIO: 4 períodos
  expect(component.periodos).toEqual(['1', '2', '3', '4']); // ✅ CAMBIO: valores numéricos
});
  });
});