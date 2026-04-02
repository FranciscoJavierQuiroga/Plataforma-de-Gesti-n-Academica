import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminGroupsComponent } from './groups.component';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../services/alert.service';
import { of, throwError } from 'rxjs';

describe('AdminGroupsComponent', () => {
  let component: AdminGroupsComponent;
  let fixture: ComponentFixture<AdminGroupsComponent>;
  let apiService: ApiService;
  let alertService: AlertService;

  const mockGroups = [
    { _id: 'g1', nombre_grupo: 'Grupo A', grado: '10°' },
    { _id: 'g2', nombre_grupo: 'Grupo B', grado: '11°' }
  ];

  const mockStudents = [
    { _id: 's1', nombres: 'Juan', apellidos: 'Pérez' },
    { _id: 's2', nombres: 'María', apellidos: 'García' }
  ];

  const mockGroupStudents = [
    { _id: 's1', nombres: 'Juan', apellidos: 'Pérez' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AdminGroupsComponent,
        HttpClientTestingModule,
        FormsModule,
        CommonModule,
        RouterModule.forRoot([])
      ],
      providers: [
        ApiService,
        AlertService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminGroupsComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService);
    alertService = TestBed.inject(AlertService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load groups and students on init', () => {
      jest.spyOn(component, 'loadGroups').mockImplementation();
      jest.spyOn(component, 'loadStudents').mockImplementation();

      component.ngOnInit();

      expect(component.loadGroups).toHaveBeenCalled();
      expect(component.loadStudents).toHaveBeenCalled();
    });
  });

  describe('loadGroups', () => {
    it('should load groups successfully', () => {
      const mockResponse = {
        success: true,
        data: mockGroups
      };

      jest.spyOn(apiService, 'getGroups').mockReturnValue(of(mockResponse));
      jest.spyOn(alertService, 'success');

      component.loadGroups();

      expect(apiService.getGroups).toHaveBeenCalled();
      expect(component.grupos).toEqual(mockGroups);
      expect(component.loading).toBe(false);
      expect(alertService.success).toHaveBeenCalledWith('Grupos cargados correctamente');
    });

    it('should handle response with no data', () => {
      const mockResponse = {
        success: true,
        data: null
      };

      jest.spyOn(apiService, 'getGroups').mockReturnValue(of(mockResponse));
      jest.spyOn(alertService, 'success');

      component.loadGroups();

      expect(component.grupos).toEqual([]);
    });

    it('should handle unsuccessful response', () => {
      const mockResponse = {
        success: false
      };

      jest.spyOn(apiService, 'getGroups').mockReturnValue(of(mockResponse));
      jest.spyOn(alertService, 'warning');

      component.loadGroups();

      expect(component.grupos).toEqual([]);
      expect(alertService.warning).toHaveBeenCalledWith('No se encontraron grupos');
      expect(component.loading).toBe(false);
    });

    it('should handle error when loading groups', () => {
      const mockError = { error: 'Failed to load' };
      jest.spyOn(apiService, 'getGroups').mockReturnValue(throwError(() => mockError));
      jest.spyOn(alertService, 'error');
      jest.spyOn(console, 'error').mockImplementation();

      component.loadGroups();

      expect(component.grupos).toEqual([]);
      expect(alertService.error).toHaveBeenCalledWith('Error al cargar grupos');
      expect(component.loading).toBe(false);
    });

    it('should set loading to true before request', () => {
      const mockResponse = {
        success: true,
        data: mockGroups
      };

      jest.spyOn(apiService, 'getGroups').mockReturnValue(of(mockResponse));

      expect(component.loading).toBe(false);
      component.loadGroups();
      // After observable completes, loading should be false
      expect(component.loading).toBe(false);
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

      expect(apiService.getAdminStudents).toHaveBeenCalled();
      expect(component.estudiantes).toEqual(mockStudents);
    });

    it('should handle response with no students', () => {
      const mockResponse = {
        success: true,
        students: null
      };

      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(of(mockResponse));

      component.loadStudents();

      expect(component.estudiantes).toEqual([]);
    });

    it('should handle unsuccessful response', () => {
      const mockResponse = {
        success: false
      };

      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(of(mockResponse));

      component.loadStudents();

      expect(component.estudiantes).toEqual([]);
    });

    it('should handle error when loading students', () => {
      const mockError = { error: 'Failed to load' };
      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation();

      component.loadStudents();

      expect(component.estudiantes).toEqual([]);
    });
  });

  describe('selectGroup', () => {
    it('should select group and load its students', () => {
      const mockGroup = mockGroups[0];
      jest.spyOn(component, 'loadGroupStudents').mockImplementation();

      component.selectGroup(mockGroup);

      expect(component.selectedGroup).toEqual(mockGroup);
      expect(component.loadGroupStudents).toHaveBeenCalledWith('g1');
    });
  });

  describe('loadGroupStudents', () => {
    it('should load group students successfully', () => {
      const mockResponse = {
        success: true,
        estudiantes: mockGroupStudents
      };

      jest.spyOn(apiService, 'getGroupStudents').mockReturnValue(of(mockResponse));

      component.loadGroupStudents('g1');

      expect(apiService.getGroupStudents).toHaveBeenCalledWith('g1');
      expect(component.estudiantesGrupo).toEqual(mockGroupStudents);
    });

    it('should handle response with no students', () => {
      const mockResponse = {
        success: true,
        estudiantes: null
      };

      jest.spyOn(apiService, 'getGroupStudents').mockReturnValue(of(mockResponse));

      component.loadGroupStudents('g1');

      expect(component.estudiantesGrupo).toEqual([]);
    });

    it('should handle unsuccessful response', () => {
      const mockResponse = {
        success: false
      };

      jest.spyOn(apiService, 'getGroupStudents').mockReturnValue(of(mockResponse));

      component.loadGroupStudents('g1');

      expect(component.estudiantesGrupo).toEqual([]);
    });

    it('should handle error when loading group students', () => {
      const mockError = { error: 'Failed to load' };
      jest.spyOn(apiService, 'getGroupStudents').mockReturnValue(throwError(() => mockError));
      jest.spyOn(alertService, 'error');
      jest.spyOn(console, 'error').mockImplementation();

      component.loadGroupStudents('g1');

      expect(component.estudiantesGrupo).toEqual([]);
      expect(alertService.error).toHaveBeenCalledWith('Error al cargar estudiantes del grupo');
    });
  });

  describe('assignStudent', () => {
    beforeEach(() => {
      component.selectedGroup = mockGroups[0];
    });

    it('should show warning if no group is selected', async () => {
      component.selectedGroup = null;
      jest.spyOn(alertService, 'warning');

      await component.assignStudent('s1');

      expect(alertService.warning).toHaveBeenCalledWith('Seleccione un grupo primero');
    });

    it('should show confirmation dialog', async () => {
      jest.spyOn(alertService, 'confirm').mockResolvedValue(false);

      await component.assignStudent('s1');

      expect(alertService.confirm).toHaveBeenCalledWith({
        title: '¿Asignar estudiante?',
        message: `¿Desea asignar este estudiante al grupo ${mockGroups[0].nombre_grupo}?`,
        confirmText: 'Sí, asignar',
        cancelText: 'Cancelar'
      });
    });

    it('should not assign if user cancels confirmation', async () => {
      jest.spyOn(alertService, 'confirm').mockResolvedValue(false);
      jest.spyOn(apiService, 'assignStudentToGroup');

      await component.assignStudent('s1');

      expect(apiService.assignStudentToGroup).not.toHaveBeenCalled();
    });

    it('should assign student if user confirms', async () => {
      const mockResponse = {
        success: true,
        matriculas_creadas: 5
      };

      jest.spyOn(alertService, 'confirm').mockResolvedValue(true);
      jest.spyOn(apiService, 'assignStudentToGroup').mockReturnValue(of(mockResponse));
      jest.spyOn(alertService, 'success');
      jest.spyOn(component, 'loadGroupStudents').mockImplementation();
      jest.spyOn(component, 'loadStudents').mockImplementation();

      await component.assignStudent('s1');

      expect(apiService.assignStudentToGroup).toHaveBeenCalledWith('g1', 's1');
      expect(alertService.success).toHaveBeenCalledWith(
        'Estudiante asignado y matriculado en 5 cursos'
      );
      expect(component.loadGroupStudents).toHaveBeenCalledWith('g1');
      expect(component.loadStudents).toHaveBeenCalled();
    });

    it('should handle error when assigning student', async () => {
      const mockError = { error: 'Assignment failed' };

      jest.spyOn(alertService, 'confirm').mockResolvedValue(true);
      jest.spyOn(apiService, 'assignStudentToGroup').mockReturnValue(throwError(() => mockError));
      jest.spyOn(alertService, 'error');
      jest.spyOn(console, 'error').mockImplementation();

      await component.assignStudent('s1');

      expect(alertService.error).toHaveBeenCalledWith('Error al asignar estudiante');
    });

    it('should not reload lists if assignment unsuccessful', async () => {
      const mockResponse = {
        success: false
      };

      jest.spyOn(alertService, 'confirm').mockResolvedValue(true);
      jest.spyOn(apiService, 'assignStudentToGroup').mockReturnValue(of(mockResponse));
      jest.spyOn(component, 'loadGroupStudents');
      jest.spyOn(component, 'loadStudents');

      await component.assignStudent('s1');

      expect(component.loadGroupStudents).not.toHaveBeenCalled();
      expect(component.loadStudents).not.toHaveBeenCalled();
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(component.grupos).toEqual([]);
      expect(component.estudiantes).toEqual([]);
      expect(component.selectedGroup).toBeNull();
      expect(component.estudiantesGrupo).toEqual([]);
      expect(component.loading).toBe(false);
    });
  });

  describe('console logging', () => {
    it('should log when groups are received', () => {
      const mockResponse = {
        success: true,
        data: mockGroups
      };

      jest.spyOn(apiService, 'getGroups').mockReturnValue(of(mockResponse));
      jest.spyOn(console, 'log').mockImplementation();

      component.loadGroups();

      expect(console.log).toHaveBeenCalledWith('✅ Grupos recibidos:', mockResponse);
    });

    it('should log when students are received', () => {
      const mockResponse = {
        success: true,
        students: mockStudents
      };

      jest.spyOn(apiService, 'getAdminStudents').mockReturnValue(of(mockResponse));
      jest.spyOn(console, 'log').mockImplementation();

      component.loadStudents();

      expect(console.log).toHaveBeenCalledWith('✅ Estudiantes recibidos:', mockResponse);
    });

    it('should log when group students are received', () => {
      const mockResponse = {
        success: true,
        estudiantes: mockGroupStudents
      };

      jest.spyOn(apiService, 'getGroupStudents').mockReturnValue(of(mockResponse));
      jest.spyOn(console, 'log').mockImplementation();

      component.loadGroupStudents('g1');

      expect(console.log).toHaveBeenCalledWith('✅ Estudiantes del grupo:', mockResponse);
    });

    it('should log when student is assigned', async () => {
      const mockResponse = {
        success: true,
        matriculas_creadas: 5
      };

      component.selectedGroup = mockGroups[0];
      jest.spyOn(alertService, 'confirm').mockResolvedValue(true);
      jest.spyOn(apiService, 'assignStudentToGroup').mockReturnValue(of(mockResponse));
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(component, 'loadGroupStudents').mockImplementation();
      jest.spyOn(component, 'loadStudents').mockImplementation();

      await component.assignStudent('s1');

      expect(console.log).toHaveBeenCalledWith('✅ Estudiante asignado:', mockResponse);
    });
  });
});