# AGENTS.md - Development Guide

## Project Overview
Academic management platform with Angular 20+ frontend (standalone components) and Flask microservices backend, using MongoDB and Keycloak for auth.

**Architecture:**
- Frontend: `src/app/` — Angular 20, standalone components, Jest testing
- Backend: `backend/{service}/app.py` — 7 Flask microservices on ports 5000-5006
- Database: MongoDB (database `colegio`), connection via env vars
- Auth: Keycloak (realm: `plataformaInstitucional`)

---

## Commands

### Frontend (Angular)
```bash
ng serve                          # Dev server on localhost:4200
ng build                          # Production build → dist/
ng test                           # Run all Jest tests
ng test --watch                   # Watch mode
jest --testPathPattern=grades     # Run tests matching "grades"
jest src/app/dashboard/teacher/grades/grades.spec.ts  # Single test file
jest --testNamePattern="should save valid grades"     # Single test by name
jest --coverage                   # Coverage report
```

### Backend (Flask Microservices)
```bash
./start_backend.sh                # Start all 7 services
./stop_backend.sh                 # Stop all services
python backend/teachers_service/app.py   # Start single service
```

**Service Ports:** login(5000), students(5001), teachers(5002), admin(5003), groups(5004), grades(5005), courses(5006)

### Deployment (Zappa)
```bash
cd backend/teachers_service && zappa update dev   # Deploy single service
cd backend/teachers_service && zappa status dev   # Check deployment status
```

---

## Code Style

### TypeScript / Angular
- **Strict mode enabled** — no `any` unless unavoidable; use proper types
- **Single quotes** for strings (per `.editorconfig` and Prettier)
- **2-space indentation**, UTF-8, trailing newline
- **Standalone components** — no NgModules for new components
- **Naming:** Components use PascalCase classes (`GradesComponent`), kebab-case selectors (`app-grades`), files match component name (`grades.ts`, `grades.html`, `grades.css`)
- **Interfaces:** Define data shapes at top of component file or in shared types
- **Services:** `@Injectable({ providedIn: 'root' })`, return `Observable<any>` from HttpClient
- **Error handling:** Use `subscribe({ next, error })` pattern; log errors with `console.error`
- **No comments** unless explicitly requested

### Python / Flask
- **Imports:** Standard library → third-party → local (use `sys.path.insert` for shared `database/` module)
- **Naming:** snake_case for functions/variables, UPPER_CASE for constants
- **Error handling:** Return `jsonify({'success': False, 'error': 'message'})` with appropriate HTTP status codes
- **Auth:** Use `@token_required('role')` decorator on all endpoints
- **DB access:** Use helper functions from `database.db_config` (`get_*_collection()`)
- **Serialization:** Always use `serialize_doc()` before returning MongoDB documents
- **ObjectId conversion:** Use `string_to_objectid()` — returns `None` on failure, never throw
- **Audit:** Call `registrar_auditoria()` for all mutations

### MongoDB
- Collections: `usuarios`, `cursos`, `matriculas`, `grupos`, `asignaciones_docentes`, `asistencia`, `observaciones`, `auditoria`, `horarios`
- Grades stored nested: `matriculas.calificaciones[{id_asignacion, periodo, notas:[{tipo, nota, peso, ...}]}]`
- Always resolve group→course via `asignaciones_docentes` — never look up group ID directly in `cursos`

---

## Key Patterns

### Frontend-Backend ID Resolution
The frontend sends **group IDs** as `course_id` parameter. Backend must resolve the actual course ID via the teacher's assignment:
```python
asignacion = asignaciones.find_one({'id_grupo': grupo_id, 'id_docente': docente_id, 'activo': True})
curso_id = asignacion['id_curso']
```

### API Service
All HTTP calls go through `ApiService` (`src/app/services/api.service.ts`). Add new methods there, not in components.

### Response Format
Backend always returns `{ success: boolean, ...data }` or `{ success: false, error: string }`.

### Environment
API URLs in `src/environments/environment.ts`. Update when deploying to new endpoints.

---

## Testing
- Jest with `jest-preset-angular`, tests co-located as `*.spec.ts`
- Use `HttpClientTestingModule` and `RouterTestingModule` for component tests
- Mock `ApiService` with `jest.fn().mockReturnValue(of(mockData))`
- Use `fakeAsync`/`tick` or `setTimeout` for async operations
- Test timeout: 10000ms (configured in `jest.config.js`)
