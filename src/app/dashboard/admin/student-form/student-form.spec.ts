import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StudentFormComponent } from './student-form';
import { ApiService } from '../../../services/api.service';

describe('StudentFormComponent', () => {
  let component: StudentFormComponent;
  let fixture: ComponentFixture<StudentFormComponent>;
  let mockApiService: jest.Mocked<ApiService>;
  let mockRouter: jest.Mocked<Router>;
  let mockActivatedRoute: any;

  const mockStudentData = {
    success: true,
    student: {
      _id: '123',
      correo: 'juan.perez@example.com',
      nombres: 'Juan',
      apellidos: 'Pérez',
      documento: '1234567890',
      tipo_doc: 'CC',
      codigo_est: 'EST001',
      fecha_nacimiento: '2005-03-15',
      direccion: 'Calle 123 #45-67',
      telefono: '3001234567',
      nombre_acudiente: 'María Pérez',
      telefono_acudiente: '3007654321',
      correo_acudiente: 'maria.perez@example.com',
      activo: true
    }
  };

  beforeEach(async () => {
    // Create mock services
    mockApiService = {
      getStudentDetail: jest.fn(),
      createStudent: jest.fn(),
      updateStudent: jest.fn()
    } as any;

    mockRouter = {
      navigate: jest.fn()
    } as any;

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jest.fn()
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [StudentFormComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentFormComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.isEdit).toBe(false);
      expect(component.studentId).toBeNull();
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
      expect(component.success).toBeNull();
    });

    it('should have default form data', () => {
      expect(component.formData.correo).toBe('');
      expect(component.formData.nombres).toBe('');
      expect(component.formData.tipo_doc).toBe('TI');
      expect(component.formData.activo).toBe(true);
    });

    it('should have 4 document types', () => {
      expect(component.tiposDocumento).toHaveLength(4);
      expect(component.tiposDocumento[0].value).toBe('TI');
      expect(component.tiposDocumento[1].value).toBe('CC');
      expect(component.tiposDocumento[2].value).toBe('CE');
      expect(component.tiposDocumento[3].value).toBe('PP');
    });

    it('should set isEdit to false when no id in route', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue(null);
      
      component.ngOnInit();
      
      expect(component.isEdit).toBe(false);
      expect(component.studentId).toBeNull();
    });

    it('should set isEdit to true and load data when id exists in route', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('123');
      mockApiService.getStudentDetail.mockReturnValue(of(mockStudentData));
      
      component.ngOnInit();
      
      expect(component.isEdit).toBe(true);
      expect(component.studentId).toBe('123');
      expect(mockApiService.getStudentDetail).toHaveBeenCalledWith('123');
    });
  });

  describe('loadStudentData', () => {
    it('should not load data if studentId is null', () => {
      component.studentId = null;
      
      component.loadStudentData();
      
      expect(mockApiService.getStudentDetail).not.toHaveBeenCalled();
    });

    it('should load student data successfully', () => {
      component.studentId = '123';
      mockApiService.getStudentDetail.mockReturnValue(of(mockStudentData));
      
      component.loadStudentData();
      
      expect(component.loading).toBe(false);
      expect(component.formData.correo).toBe('juan.perez@example.com');
      expect(component.formData.nombres).toBe('Juan');
      expect(component.formData.apellidos).toBe('Pérez');
      expect(component.formData.documento).toBe('1234567890');
      expect(component.formData.tipo_doc).toBe('CC');
      expect(component.formData.codigo_est).toBe('EST001');
    });

    it('should format date correctly when loading student data', () => {
      component.studentId = '123';
      mockApiService.getStudentDetail.mockReturnValue(of(mockStudentData));
      
      component.loadStudentData();
      
      expect(component.formData.fecha_nacimiento).toBe('2005-03-15');
    });

    it('should handle missing optional fields', () => {
      component.studentId = '123';
      const dataWithoutOptionalFields = {
        success: true,
        student: {
          correo: 'test@example.com',
          nombres: 'Test',
          apellidos: 'User',
          documento: '123',
          codigo_est: 'EST001'
        }
      };
      mockApiService.getStudentDetail.mockReturnValue(of(dataWithoutOptionalFields));
      
      component.loadStudentData();
      
      expect(component.formData.direccion).toBe('');
      expect(component.formData.telefono).toBe('');
      expect(component.formData.nombre_acudiente).toBe('');
      expect(component.formData.tipo_doc).toBe('TI');
    });

    it('should handle activo field as true by default', () => {
      component.studentId = '123';
      const dataWithoutActivo = {
        success: true,
        student: {
          correo: 'test@example.com',
          nombres: 'Test',
          apellidos: 'User',
          documento: '123',
          codigo_est: 'EST001'
        }
      };
      mockApiService.getStudentDetail.mockReturnValue(of(dataWithoutActivo));
      
      component.loadStudentData();
      
      expect(component.formData.activo).toBe(true);
    });

    it('should handle activo field as false when explicitly set', () => {
      component.studentId = '123';
      const dataWithActivoFalse = {
        success: true,
        student: {
          ...mockStudentData.student,
          activo: false
        }
      };
      mockApiService.getStudentDetail.mockReturnValue(of(dataWithActivoFalse));
      
      component.loadStudentData();
      
      expect(component.formData.activo).toBe(false);
    });

    it('should handle error when loading student data', () => {
      component.studentId = '123';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiService.getStudentDetail.mockReturnValue(
        throwError(() => new Error('API Error'))
      );
      
      component.loadStudentData();
      
      expect(component.loading).toBe(false);
      expect(component.error).toBe('Error al cargar los datos del estudiante');
      consoleErrorSpy.mockRestore();
    });

    it('should set loading to true when starting to load data', () => {
      component.studentId = '123';
      mockApiService.getStudentDetail.mockReturnValue(of(mockStudentData));
      
      component.loadStudentData();
      
      expect(mockApiService.getStudentDetail).toHaveBeenCalled();
    });
  });

  describe('validateForm', () => {
    beforeEach(() => {
      component.formData = {
        correo: 'test@example.com',
        nombres: 'Test',
        apellidos: 'User',
        documento: '123456',
        tipo_doc: 'CC',
        codigo_est: 'EST001',
        fecha_nacimiento: '2005-01-01',
        direccion: 'Test Address',
        telefono: '3001234567',
        nombre_acudiente: 'Parent Name',
        telefono_acudiente: '3007654321',
        correo_acudiente: 'parent@example.com',
        activo: true
      };
    });

    it('should return true for valid form data', () => {
      const result = component.validateForm();
      
      expect(result).toBe(true);
      expect(component.error).toBeNull();
    });

    it('should return false if correo is empty', () => {
      component.formData.correo = '';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should return false if nombres is empty', () => {
      component.formData.nombres = '';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should return false if apellidos is empty', () => {
      component.formData.apellidos = '';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should return false if documento is empty', () => {
      component.formData.documento = '';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should return false if codigo_est is empty', () => {
      component.formData.codigo_est = '';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should return false for invalid email format', () => {
      component.formData.correo = 'invalid-email';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor ingrese un correo electrónico válido');
    });

    it('should return false for email without @', () => {
      component.formData.correo = 'invalidemail.com';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor ingrese un correo electrónico válido');
    });

    it('should return false for email without domain', () => {
      component.formData.correo = 'invalid@';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor ingrese un correo electrónico válido');
    });

    it('should return false for invalid correo_acudiente', () => {
      component.formData.correo_acudiente = 'invalid-email';
      
      const result = component.validateForm();
      
      expect(result).toBe(false);
      expect(component.error).toBe('Por favor ingrese un correo de acudiente válido');
    });

    it('should return true if correo_acudiente is empty', () => {
      component.formData.correo_acudiente = '';
      
      const result = component.validateForm();
      
      expect(result).toBe(true);
    });

    it('should validate all email formats correctly', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        component.formData.correo = email;
        expect(component.validateForm()).toBe(true);
      });
    });
  });

  describe('onSubmit - Create Student', () => {
    beforeEach(() => {
      component.isEdit = false;
      component.studentId = null;
      component.formData = {
        correo: 'new@example.com',
        nombres: 'New',
        apellidos: 'Student',
        documento: '999999',
        tipo_doc: 'TI',
        codigo_est: 'EST999',
        fecha_nacimiento: '2008-01-01',
        direccion: 'New Address',
        telefono: '3009999999',
        nombre_acudiente: 'Parent',
        telefono_acudiente: '3008888888',
        correo_acudiente: 'parent@example.com',
        activo: true
      };
    });

    it('should create student successfully', fakeAsync(() => {
      const createResponse = { success: true, student: { _id: 'new123' } };
      mockApiService.createStudent.mockReturnValue(of(createResponse));
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      component.onSubmit();
      
      expect(mockApiService.createStudent).toHaveBeenCalledWith(component.formData);
      expect(component.success).toBe('Estudiante creado exitosamente');
      expect(component.loading).toBe(false);
      
      tick(1500);
      
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
      consoleLogSpy.mockRestore();
    }));

    it('should handle error when creating student', () => {
      const errorResponse = { error: { error: 'Email already exists' } };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiService.createStudent.mockReturnValue(
        throwError(() => errorResponse)
      );
      
      component.onSubmit();
      
      expect(component.loading).toBe(false);
      expect(component.error).toBe('Email already exists');
      consoleErrorSpy.mockRestore();
    });

    it('should handle error without specific message', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiService.createStudent.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      
      component.onSubmit();
      
      expect(component.error).toBe('Error al crear el estudiante');
      consoleErrorSpy.mockRestore();
    });

    it('should not submit if validation fails', () => {
      component.formData.correo = '';
      
      component.onSubmit();
      
      expect(mockApiService.createStudent).not.toHaveBeenCalled();
      expect(component.error).toBe('Por favor complete todos los campos obligatorios');
    });

    it('should clear previous error and success messages on submit', () => {
      component.error = 'Previous error';
      component.success = 'Previous success';
      mockApiService.createStudent.mockReturnValue(of({ success: true }));
      
      component.onSubmit();
      
      // After submit starts, error and success should be null initially
      // Then success gets set by the observable response
      expect(mockApiService.createStudent).toHaveBeenCalled();
      expect(component.success).toBe('Estudiante creado exitosamente');
    });
  });

  describe('onSubmit - Update Student', () => {
    beforeEach(() => {
      component.isEdit = true;
      component.studentId = '123';
      component.formData = {
        correo: 'updated@example.com',
        nombres: 'Updated',
        apellidos: 'Student',
        documento: '123456',
        tipo_doc: 'CC',
        codigo_est: 'EST001',
        fecha_nacimiento: '2005-01-01',
        direccion: 'Updated Address',
        telefono: '3001111111',
        nombre_acudiente: 'Updated Parent',
        telefono_acudiente: '3002222222',
        correo_acudiente: 'updatedparent@example.com',
        activo: true
      };
    });

    it('should update student successfully', fakeAsync(() => {
      const updateResponse = { success: true, student: mockStudentData.student };
      mockApiService.updateStudent.mockReturnValue(of(updateResponse));
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      component.onSubmit();
      
      expect(mockApiService.updateStudent).toHaveBeenCalledWith('123', component.formData);
      
      tick();
      
      expect(component.success).toBe('Estudiante actualizado exitosamente');
      expect(component.loading).toBe(false);
      
      tick(1500);
      
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
      consoleLogSpy.mockRestore();
    }));

    it('should handle error when updating student', () => {
      const errorResponse = { error: { error: 'Student not found' } };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiService.updateStudent.mockReturnValue(
        throwError(() => errorResponse)
      );
      
      component.onSubmit();
      
      expect(component.loading).toBe(false);
      expect(component.error).toBe('Student not found');
      consoleErrorSpy.mockRestore();
    });

    it('should handle error without specific message when updating', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiService.updateStudent.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      
      component.onSubmit();
      
      expect(component.error).toBe('Error al actualizar el estudiante');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('goBack', () => {
    it('should navigate back to admin dashboard', () => {
      component.goBack();
      
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
    });
  });

  describe('resetForm', () => {
    it('should reset form data to initial values', () => {
      component.formData = {
        correo: 'test@example.com',
        nombres: 'Test',
        apellidos: 'User',
        documento: '123',
        tipo_doc: 'CC',
        codigo_est: 'EST001',
        fecha_nacimiento: '2005-01-01',
        direccion: 'Address',
        telefono: '3001234567',
        nombre_acudiente: 'Parent',
        telefono_acudiente: '3007654321',
        correo_acudiente: 'parent@example.com',
        activo: false
      };
      component.error = 'Some error';
      component.success = 'Some success';
      
      component.resetForm();
      
      expect(component.formData.correo).toBe('');
      expect(component.formData.nombres).toBe('');
      expect(component.formData.apellidos).toBe('');
      expect(component.formData.documento).toBe('');
      expect(component.formData.tipo_doc).toBe('TI');
      expect(component.formData.codigo_est).toBe('');
      expect(component.formData.activo).toBe(true);
      expect(component.error).toBeNull();
      expect(component.success).toBeNull();
    });

    it('should clear all optional fields', () => {
      component.formData.direccion = 'Some address';
      component.formData.telefono = '3001234567';
      component.formData.nombre_acudiente = 'Parent';
      
      component.resetForm();
      
      expect(component.formData.direccion).toBe('');
      expect(component.formData.telefono).toBe('');
      expect(component.formData.nombre_acudiente).toBe('');
      expect(component.formData.telefono_acudiente).toBe('');
      expect(component.formData.correo_acudiente).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle date formatting when fecha_nacimiento is null', () => {
      component.studentId = '123';
      const dataWithNullDate = {
        success: true,
        student: {
          ...mockStudentData.student,
          fecha_nacimiento: null
        }
      };
      mockApiService.getStudentDetail.mockReturnValue(of(dataWithNullDate));
      
      component.loadStudentData();
      
      expect(component.formData.fecha_nacimiento).toBe('');
    });

    it('should handle multiple validation errors sequentially', () => {
      component.formData.correo = '';
      expect(component.validateForm()).toBe(false);
      expect(component.error).toContain('campos obligatorios');
      
      component.formData.correo = 'test@example.com';
      component.formData.nombres = '';
      expect(component.validateForm()).toBe(false);
      expect(component.error).toContain('campos obligatorios');
      
      // Reset all required fields
      component.formData.nombres = 'Test';
      component.formData.apellidos = 'User';
      component.formData.documento = '123';
      component.formData.codigo_est = 'EST001';
      component.formData.correo = 'invalid';
      expect(component.validateForm()).toBe(false);
      expect(component.error).toContain('correo electrónico válido');
    });

    it('should handle rapid form submissions', fakeAsync(() => {
      // Set up valid form data
      component.formData = {
        correo: 'test@example.com',
        nombres: 'Test',
        apellidos: 'User',
        documento: '123456',
        tipo_doc: 'CC',
        codigo_est: 'EST001',
        fecha_nacimiento: '2005-01-01',
        direccion: 'Test Address',
        telefono: '3001234567',
        nombre_acudiente: 'Parent Name',
        telefono_acudiente: '3007654321',
        correo_acudiente: 'parent@example.com',
        activo: true
      };
      
      const createResponse = { success: true, student: { _id: 'new123' } };
      mockApiService.createStudent.mockReturnValue(of(createResponse));
      
      // First submission
      component.onSubmit();
      expect(mockApiService.createStudent).toHaveBeenCalledTimes(1);
      
      // Reset loading state to simulate rapid clicking
      component.loading = false;
      component.success = null;
      
      // Second submission
      component.onSubmit();
      
      tick();
      
      // Both submissions should have gone through
      expect(mockApiService.createStudent).toHaveBeenCalledTimes(2);
    }));
  });
});