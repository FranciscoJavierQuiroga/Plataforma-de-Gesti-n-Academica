# Guía de Pruebas Jest - Plataforma de Gestión Académica

## ✅ Archivos de Prueba Completados

1. **`src/app/authentication/login/login.spec.ts`** - ✅ COMPLETO
   - Pruebas de validación de formulario
   - Pruebas de autenticación
   - Pruebas de navegación por rol
   - Pruebas de manejo de errores

2. **`src/app/services/auth.service.spec.ts`** - ✅ COMPLETO
   - Pruebas de almacenamiento de tokens
   - Pruebas de recuperación de tokens
   - Pruebas de limpieza de sesión

3. **`src/app/services/api.service.spec.ts`** - ✅ COMPLETO
   - Pruebas de todas las llamadas HTTP
   - Pruebas de endpoints de estudiantes
   - Pruebas de endpoints de profesores
   - Pruebas de endpoints de administrador
   - Pruebas de manejo de errores

4. **`src/app/dashboard/admin/admin.spec.ts`** - ✅ COMPLETO
   - Pruebas de carga de estadísticas
   - Pruebas de tareas pendientes
   - Pruebas de manejo de errores

## 📋 Archivos Pendientes (Templates Incluidos Abajo)

### Dashboard Components

#### Student Component
```typescript
// src/app/dashboard/student/student.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Student } from './student';
import { ApiService } from '../../services/api.service';

describe('StudentComponent', () => {
  let component: Student;
  let fixture: ComponentFixture<Student>;
  let mockApiService: jest.Mocked<ApiService>;

  beforeEach(async () => {
    mockApiService = {
      getStudentGrades: jest.fn(),
      getStudentNotifications: jest.fn(),
      getStudentSchedule: jest.fn()
    } as any;

    await TestBed.configureTestingModule({
      imports: [Student],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Student);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load student grades', () => {
    const mockGrades = { success: true, data: [] };
    mockApiService.getStudentGrades.mockReturnValue(of(mockGrades));
    
    // Add your test logic here
  });
});
```

#### Teacher Component
```typescript
// src/app/dashboard/teacher/teacher.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Teacher } from './teacher';
import { ApiService } from '../../services/api.service';

describe('TeacherComponent', () => {
  let component: Teacher;
  let fixture: ComponentFixture<Teacher>;
  let mockApiService: jest.Mocked<ApiService>;

  beforeEach(async () => {
    mockApiService = {
      getTeacherGroups: jest.fn(),
      getTeacherPendingGrades: jest.fn(),
      getTeacherOverview: jest.fn()
    } as any;

    await TestBed.configureTestingModule({
      imports: [Teacher],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Teacher);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load teacher groups', () => {
    const mockGroups = { success: true, groups: [] };
    mockApiService.getTeacherGroups.mockReturnValue(of(mockGroups));
    
    // Add your test logic here
  });
});
```

### Guards
```typescript
// src/app/authentication/role.guard.spec.ts
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RoleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let mockRouter: jest.Mocked<Router>;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockRouter = {
      navigate: jest.fn()
    } as any;

    mockAuthService = {
      getToken: jest.fn()
    } as any;

    TestBed.configureTestingModule({
      providers: [
        RoleGuard,
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService }
      ]
    });

    guard = TestBed.inject(RoleGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access when user has valid token', () => {
    mockAuthService.getToken.mockReturnValue('valid-token');
    // Add canActivate test logic
  });

  it('should redirect to login when no token', () => {
    mockAuthService.getToken.mockReturnValue(null);
    // Add navigation test
  });
});
```

### Interceptors
```typescript
// src/app/interceptors/auth.interceptor.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('AuthInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockAuthService = {
      getToken: jest.fn()
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true
        },
        { provide: AuthService, useValue: mockAuthService }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header when token exists', () => {
    mockAuthService.getToken.mockReturnValue('test-token');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('should not add Authorization header when no token', () => {
    mockAuthService.getToken.mockReturnValue(null);

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
```

### Module Components (Students, Teachers, Groups, Grades, Reports)

```typescript
// Template genérico para componentes de módulos
describe('ModuleComponent', () => {
  let component: YourComponent;
  let fixture: ComponentFixture<YourComponent>;
  let mockApiService: jest.Mocked<ApiService>;

  beforeEach(async () => {
    mockApiService = {
      // Mock methods needed
    } as any;

    await TestBed.configureTestingModule({
      imports: [YourComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(YourComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Add specific tests for:
  // - CRUD operations
  // - Form validations
  // - API calls
  // - Error handling
  // - User interactions
});
```

## 🚀 Comandos para Ejecutar las Pruebas

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar pruebas con cobertura
npm run test:coverage

# Ejecutar pruebas en modo watch
npm run test:watch

# Ejecutar pruebas de un archivo específico
npm test -- login.spec.ts
```

## 📊 Configuración Jest

Asegúrate de tener `jest.config.js` configurado:

```javascript
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/environments/**'
  ],
  moduleNameMapper: {
    '@app/(.*)': '<rootDir>/src/app/$1',
    '@environments/(.*)': '<rootDir>/src/environments/$1'
  }
};
```

## 📝 Checklist de Pruebas por Componente

### ✅ Login Component
- [x] Validación de campos vacíos
- [x] Llamada al API de login
- [x] Almacenamiento de token
- [x] Navegación por rol
- [x] Manejo de errores
- [x] Loading states

### ✅ Auth Service
- [x] setToken
- [x] getToken
- [x] clear
- [x] Integración con localStorage

### ✅ API Service
- [x] Todos los endpoints de login
- [x] Endpoints de estudiantes
- [x] Endpoints de profesores
- [x] Endpoints de administrador
- [x] Manejo de errores HTTP

### ⏳ Pendientes
- [ ] Student Dashboard Component
- [ ] Teacher Dashboard Component  
- [ ] Register Component
- [ ] Role Guard
- [ ] Auth Interceptor
- [ ] Students Module Components
- [ ] Teachers Module Components
- [ ] Groups Module Components
- [ ] Grades Module Components
- [ ] Reports Module Components

## 💡 Tips para Escribir Pruebas

1. **Usa mocks para dependencias externas**
2. **Limpia el localStorage en afterEach**
3. **Prueba casos de éxito Y error**
4. **Verifica llamadas a APIs con toHaveBeenCalled()**
5. **Prueba estados de carga (loading)**
6. **Mockea navegación del router**
7. **Usa fixtures para componentes Angular**
8. **Agrupa pruebas relacionadas con describe()**

## 🎯 Objetivo de Cobertura

- **Mínimo:** 80% de cobertura
- **Ideal:** 90%+ de cobertura
- **Crítico:** 100% en servicios de autenticación y API

---

**Nota:** Los archivos marcados con ✅ ya están implementados y listos para ejecutar. Los demás requieren completar usando los templates proporcionados.
