import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import AdminComponent from './admin';
import { ApiService } from '../../services/api.service';
import { AlertService } from '../../services/alert.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let apiService: jest.Mocked<ApiService>;
  let alertService: jest.Mocked<AlertService>;
  let router: Router;

  // Mock data
  const mockStudents = [
    { _id: '1', nombres: 'Juan', apellidos: 'Pérez', codigo_est: 'EST001' },
    { _id: '2', nombres: 'María', apellidos: 'González', codigo_est: 'EST002' }
  ];

  const mockCourses = [
    { _id: '1', nombre: 'Matemáticas 10°', codigo: 'MAT10', grado: '10' },
    { _id: '2', nombre: 'Español 11°', codigo: 'ESP11', grado: '11' }
  ];

  const mockEnrollments = [
    { _id: '1', estudiante_info: { nombres: 'Juan' }, curso_info: { nombre: 'Matemáticas' }, estado: 'activo' },
    { _id: '2', estudiante_info: { nombres: 'María' }, curso_info: { nombre: 'Español' }, estado: 'pendiente' }
  ];

  const mockStats = {
    success: true,
    total_estudiantes: 150,
    total_cursos: 25,
    total_docentes: 20,
    total_matriculas: 350,
    matriculas_pendientes: 5
  };

  // ✅ Mock real de localStorage que el componente va a usar
  let getItemSpy: jest.SpyInstance;
  let setItemSpy: jest.SpyInstance;
  let removeItemSpy: jest.SpyInstance;
  let clearSpy: jest.SpyInstance;

  beforeEach(async () => {
    // ✅ Espiar el objeto localStorage GLOBAL, no el prototipo
    getItemSpy = jest.spyOn(window.localStorage, 'getItem').mockReturnValue(null);
    setItemSpy = jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => { });
    removeItemSpy = jest.spyOn(window.localStorage, 'removeItem').mockImplementation(() => { });
    clearSpy = jest.spyOn(window.localStorage, 'clear').mockImplementation(() => { });

    // Create mocks
    const apiServiceMock = {
      getAdminStudents: jest.fn(),
      getAdminCourses: jest.fn(),
      getAdminEnrollments: jest.fn(),
      getAdminStatistics: jest.fn(),
      deleteStudent: jest.fn(),
      deleteCourse: jest.fn(),
      updateEnrollment: jest.fn(),
      deleteEnrollment: jest.fn()
    };

    const alertServiceMock = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      confirm: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        AdminComponent,
        CommonModule,
        RouterModule,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: AlertService, useValue: alertServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService) as jest.Mocked<ApiService>;
    alertService = TestBed.inject(AlertService) as jest.Mocked<AlertService>;
    router = TestBed.inject(Router);

    // Setup default mock responses
    apiService.getAdminStudents.mockReturnValue(of({ success: true, students: mockStudents }));
    apiService.getAdminCourses.mockReturnValue(of({ success: true, courses: mockCourses }));
    apiService.getAdminEnrollments.mockReturnValue(of({ success: true, enrollments: mockEnrollments }));
    apiService.getAdminStatistics.mockReturnValue(of(mockStats));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ==========================================
  //   TESTS DE CREACIÓN
  // ==========================================

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      // ✅ No llamar ngOnInit todavía
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
      expect(component.activeView).toBe('dashboard');
      expect(component.adminName).toBe('Administrador');
      expect(component.students).toEqual([]);
      expect(component.courses).toEqual([]);
      expect(component.enrollments).toEqual([]);
    });

    it('should have correct stats initial values', () => {
      expect(component.stats).toEqual({
        totalStudents: 0,
        totalCourses: 0,
        totalTeachers: 0,
        totalEnrollments: 0,
        pendingEnrollments: 0
      });
    });
  });

  // ==========================================
  //   TESTS DE INICIALIZACIÓN
  // ==========================================

  describe('ngOnInit', () => {
    it('should call loadUserInfo and loadData on init', () => {
      const loadUserInfoSpy = jest.spyOn(component, 'loadUserInfo').mockImplementation(() => { });
      const loadDataSpy = jest.spyOn(component, 'loadData').mockImplementation(() => Promise.resolve());

      // ✅ Llamar detectChanges para ejecutar ngOnInit
      fixture.detectChanges();

      expect(loadUserInfoSpy).toHaveBeenCalled();
      expect(loadDataSpy).toHaveBeenCalled();
    });
  });

  // ==========================================
  //   TESTS DE CARGA DE USUARIO
  // ==========================================

  describe('loadUserInfo', () => {
    it('should load user info from localStorage', () => {
      const mockUser = { nombres: 'Carlos Admin', apellidos: 'López' };
      // ✅ Limpiar llamadas previas y configurar el mock
      getItemSpy.mockClear();
      getItemSpy.mockReturnValue(JSON.stringify(mockUser));

      component.loadUserInfo();

      expect(getItemSpy).toHaveBeenCalledWith('userInfo');
      expect(component.adminName).toBe('Carlos Admin');
    });

    it('should use default name if userInfo is not in localStorage', () => {
      getItemSpy.mockClear();
      getItemSpy.mockReturnValue(null);

      component.loadUserInfo();

      expect(component.adminName).toBe('Administrador');
    });

    it('should handle invalid JSON in localStorage', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      getItemSpy.mockClear();
      getItemSpy.mockReturnValue('invalid-json');

      component.loadUserInfo();

      expect(component.adminName).toBe('Administrador');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================
  //   TESTS DE CARGA DE DATOS
  // ==========================================

  describe('loadData', () => {
    it('should set loading to true initially', () => {
      component.loadData();

      expect(component.loading).toBe(true);
    });

    it('should load all data successfully', async () => {
      await component.loadData();

      expect(apiService.getAdminStudents).toHaveBeenCalled();
      expect(apiService.getAdminCourses).toHaveBeenCalled();
      expect(apiService.getAdminEnrollments).toHaveBeenCalled();
      expect(apiService.getAdminStatistics).toHaveBeenCalled();
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
    });

    it('should handle errors when loading data', async () => {
      // ✅ Silenciar console.error para este test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      apiService.getAdminStudents.mockReturnValue(throwError(() => new Error('API Error')));

      await component.loadData();

      expect(component.error).toBe('Error al cargar los datos del panel');
      expect(component.loading).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================
  //   TESTS DE CARGA DE ESTUDIANTES
  // ==========================================

  describe('loadStudents', () => {
    it('should load students successfully', async () => {
      await component.loadStudents();

      expect(apiService.getAdminStudents).toHaveBeenCalled();
      expect(component.students).toEqual(mockStudents);
    });

    it('should handle error when loading students', async () => {
      // ✅ Silenciar console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      apiService.getAdminStudents.mockReturnValue(throwError(() => new Error('Error')));

      await expect(component.loadStudents()).rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================
  //   TESTS DE CARGA DE CURSOS
  // ==========================================

  describe('loadCourses', () => {
    it('should load courses successfully', async () => {
      await component.loadCourses();

      expect(apiService.getAdminCourses).toHaveBeenCalled();
      expect(component.courses).toEqual(mockCourses);
    });

    it('should handle error when loading courses', async () => {
      // ✅ Silenciar console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      apiService.getAdminCourses.mockReturnValue(throwError(() => new Error('Error')));

      await expect(component.loadCourses()).rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================
  //   TESTS DE CARGA DE MATRÍCULAS
  // ==========================================

  describe('loadEnrollments', () => {
    it('should load enrollments successfully', async () => {
      await component.loadEnrollments();

      expect(apiService.getAdminEnrollments).toHaveBeenCalled();
      expect(component.enrollments).toEqual(mockEnrollments);
    });

    it('should handle error when loading enrollments', async () => {
      // ✅ Silenciar console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      apiService.getAdminEnrollments.mockReturnValue(throwError(() => new Error('Error')));

      await expect(component.loadEnrollments()).rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================
  //   TESTS DE CARGA DE ESTADÍSTICAS
  // ==========================================

  describe('loadStats', () => {
    it('should load and map statistics correctly', async () => {
      await component.loadStats();

      expect(apiService.getAdminStatistics).toHaveBeenCalled();
      expect(component.stats).toEqual({
        totalStudents: 150,
        totalCourses: 25,
        totalTeachers: 20,
        totalEnrollments: 350,
        pendingEnrollments: 5
      });
    });

    it('should handle response without success flag', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

      apiService.getAdminStatistics.mockReturnValue(of({ success: false }));

      await component.loadStats();

      expect(component.stats.totalStudents).toBe(0);

      consoleWarnSpy.mockRestore();
    });

    it('should handle error when loading stats', async () => {
      // ✅ Silenciar console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      apiService.getAdminStatistics.mockReturnValue(throwError(() => new Error('Error')));

      await expect(component.loadStats()).rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================
  //   TESTS DE CAMBIO DE VISTA
  // ==========================================

  describe('changeView', () => {
    it('should change active view to students', () => {
      component.changeView('students');

      expect(component.activeView).toBe('students');
    });

    it('should change active view to courses', () => {
      component.changeView('courses');

      expect(component.activeView).toBe('courses');
    });

    it('should change active view to enrollments', () => {
      component.changeView('enrollments');

      expect(component.activeView).toBe('enrollments');
    });

    it('should change active view back to dashboard', () => {
      component.changeView('students');
      component.changeView('dashboard');

      expect(component.activeView).toBe('dashboard');
    });
  });

  // ==========================================
  //   TESTS DE NAVEGACIÓN
  // ==========================================

  describe('goToReports', () => {
    it('should navigate to reports page', () => {
      const navigateSpy = jest.spyOn(router, 'navigate');

      component.goToReports();

      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/admin/reports']);
    });
  });

  // ==========================================
  //   TESTS DE ELIMINACIÓN DE ESTUDIANTE
  // ==========================================

  describe('deleteStudent', () => {
    it('should delete student when confirmed', async () => {
      alertService.confirm.mockResolvedValue(true);
      apiService.deleteStudent.mockReturnValue(of({ success: true }));

      await component.deleteStudent('1');

      expect(alertService.confirm).toHaveBeenCalled();
      expect(apiService.deleteStudent).toHaveBeenCalledWith('1');
      expect(alertService.success).toHaveBeenCalledWith('Estudiante eliminado correctamente');
    });

    it('should not delete student when cancelled', async () => {
      alertService.confirm.mockResolvedValue(false);

      await component.deleteStudent('1');

      expect(alertService.confirm).toHaveBeenCalled();
      expect(apiService.deleteStudent).not.toHaveBeenCalled();
    });

    it('should show error message on delete failure', async () => {
      alertService.confirm.mockResolvedValue(true);
      apiService.deleteStudent.mockReturnValue(throwError(() => new Error('Error')));

      await component.deleteStudent('1');

      expect(alertService.error).toHaveBeenCalledWith('No se pudo eliminar el estudiante');
    });
  });

  // ==========================================
  //   TESTS DE ELIMINACIÓN DE CURSO
  // ==========================================

  describe('deleteCourse', () => {
    it('should delete course when confirmed', () => {
      window.confirm = jest.fn(() => true);
      apiService.deleteCourse.mockReturnValue(of({ success: true }));

      component.deleteCourse('1');

      expect(apiService.deleteCourse).toHaveBeenCalledWith('1');
    });

    it('should not delete course when cancelled', () => {
      window.confirm = jest.fn(() => false);

      component.deleteCourse('1');

      expect(apiService.deleteCourse).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  //   TESTS DE GESTIÓN DE MATRÍCULAS
  // ==========================================

  describe('approveEnrollment', () => {
    it('should approve enrollment when confirmed', () => {
      window.confirm = jest.fn(() => true);
      apiService.updateEnrollment.mockReturnValue(of({ success: true }));

      component.approveEnrollment('1');

      expect(apiService.updateEnrollment).toHaveBeenCalledWith('1', { estado: 'aprobado' });
    });

    it('should not approve enrollment when cancelled', () => {
      window.confirm = jest.fn(() => false);

      component.approveEnrollment('1');

      expect(apiService.updateEnrollment).not.toHaveBeenCalled();
    });
  });

  describe('rejectEnrollment', () => {
    it('should reject enrollment when confirmed', () => {
      window.confirm = jest.fn(() => true);
      apiService.updateEnrollment.mockReturnValue(of({ success: true }));

      component.rejectEnrollment('1');

      expect(apiService.updateEnrollment).toHaveBeenCalledWith('1', { estado: 'rechazado' });
    });
  });

  describe('deleteEnrollment', () => {
    it('should delete enrollment when confirmed', () => {
      window.confirm = jest.fn(() => true);
      apiService.deleteEnrollment.mockReturnValue(of({ success: true }));

      component.deleteEnrollment('1');

      expect(apiService.deleteEnrollment).toHaveBeenCalledWith('1');
    });
  });

  // ==========================================
  //   TESTS DE LOGOUT
  // ==========================================

  describe('logout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // ✅ Limpiar el mock antes de cada test de logout
      removeItemSpy.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should logout when confirmed', async () => {
      alertService.confirm.mockResolvedValue(true);
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      await component.logout();

      expect(alertService.confirm).toHaveBeenCalled();
      expect(removeItemSpy).toHaveBeenCalledWith('access_token');
      expect(removeItemSpy).toHaveBeenCalledWith('user_role');
      expect(removeItemSpy).toHaveBeenCalledWith('userInfo');
      expect(alertService.success).toHaveBeenCalledWith('Sesión cerrada exitosamente', '👋 Hasta pronto');

      jest.advanceTimersByTime(1000);
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });

    it('should not logout when cancelled', async () => {
      alertService.confirm.mockResolvedValue(false);
      const navigateSpy = jest.spyOn(router, 'navigate');

      await component.logout();

      expect(removeItemSpy).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  //   TESTS DE INTEGRACIÓN
  // ==========================================

  describe('Integration Tests', () => {
    it('should load all data on component initialization', async () => {
      // ✅ Llamar detectChanges para iniciar el ciclo de vida
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.students.length).toBeGreaterThan(0);
      expect(component.courses.length).toBeGreaterThan(0);
      expect(component.enrollments.length).toBeGreaterThan(0);
      expect(component.stats.totalStudents).toBeGreaterThan(0);
    });

    it('should handle complete workflow of changing views', () => {
      // ✅ Este test no necesita detectChanges porque no depende del ciclo de vida
      component.changeView('students');
      expect(component.activeView).toBe('students');

      component.changeView('courses');
      expect(component.activeView).toBe('courses');

      component.changeView('enrollments');
      expect(component.activeView).toBe('enrollments');

      component.changeView('dashboard');
      expect(component.activeView).toBe('dashboard');
    });
  });
});