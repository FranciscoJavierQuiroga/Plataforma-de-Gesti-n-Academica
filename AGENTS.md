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
ng test                           # Run all Jest tests via Angular builder
ng test --watch                   # Watch mode
npm run test                      # Run Jest directly
npm run test:watch                # Jest watch mode via npm script
npm run test:coverage             # Coverage report
npm run test:ci                   # CI mode with coverage (2 workers)
npm run test:debug                # Node debugger for tests
npm run test:file <path>          # Run related tests for a file
jest --testPathPattern=grades     # Run tests matching "grades"
jest src/app/dashboard/teacher/grades/grades.spec.ts  # Single test file
jest --testNamePattern="should save valid grades"     # Single test by name
```

**Build targets:**
- `ng build` — production (default)
- `ng build --configuration development` — dev build
- `ng build -c lambda` / `npm run build:lambda` — Lambda deployment build (replaces `environment.ts` with `environment.prod.ts`)

### Backend (Flask Microservices)
```bash
./start_backend.sh                # Start all 7 services
./stop_backend.sh                 # Stop all services (uses port 5000-5006 loop)
python backend/teachers_service/app.py &   # Start single service
```

**Service Ports:** login(5000), students(5001), teachers(5002), admin(5003), groups(5004), grades(5005), courses(5006)

### Deployment (Zappa)
Each service has its own `zappa_settings.json` with `dev` and `production` stages.
```bash
cd backend/<service> && zappa update dev         # Deploy single service
cd backend/<service> && zappa status dev            # Check deployment status
```
Supported stages: `dev`, `production`.

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

### Frontend (Jest)
- Runner: `jest-preset-angular`, tests co-located as `*.spec.ts`
- Entry: `src/setup-jest.ts` — mocks `localStorage`, `sessionStorage`, `matchMedia`, `IntersectionObserver`, `ResizeObserver`, `fetch`, and suppresses console logs in tests
- **Timeout:** 10 000 ms (root `jest.config.js`)
- **Aliases:** `@app`, `@environments`, `@services`, `@shared`, `@guards`, `@interceptors` mapped in `jest.config.js`
- **Asset transforms:** CSS/SCSS and images use `jest-transform-stub`
- **Snapshot serializers:** `jest-preset-angular` serializers for Angular internals

### Test Commands Recap
```bash
jest --testPathPattern=<pattern>           # Filter by file path
jest --testNamePattern="<name>"            # Filter by test name
npm run test:file <file>                   # Run related tests for a specific file
```

### Backend
- No backend unit tests or test runners (pytest/unittest) are present in the repository.

---

## Repo-Specific Conventions

### File Naming & Structure
- Component files match the component name exactly: `grades.ts`, `grades.html`, `grades.css`
- No NgModules — new components must be standalone and use `loadComponent` in routes
- Dashboard modules: `dashboard/student/`, `dashboard/teacher/`, `dashboard/admin/`
- Guards: `RoleGuard` is a `CanActivateFn` (function-based guard), not a class

### Jest Configuration Notes
- Root `jest.config.js` is the source of truth; `src/jest.config.js` is an older subset and may be ignored or cleaned up later
- `transformIgnorePatterns` allows `@angular`, `@ngrx`, `rxjs`, `tslib`, `chart.js`
- `collectCoverageFrom` excludes `*.module.ts`, `*.routes.ts`, `main.ts`, `environments/`, and `setup-jest.ts`

### Angular Build Quirks
- `angular.json` defines a `lambda` configuration that replaces `src/environments/environment.ts` with `environment.prod.ts`
- Builder: `@angular/build:application` (not legacy webpack)
- Budget limits: initial 500 kB warning / 1 MB error; component styles 4 kB warning / 10 kB error

### Backend Notes
- CORS is configured per service with explicit origins: `http://localhost:4200`, `http://localhost:4300`, `https://plataformadegestionacademica.vercel.app`
- `sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))` is the standard pattern for importing the shared `database/` module from any service

---

## Local Development Infrastructure

### Docker Compose (Keycloak + MongoDB)
```bash
./start_infrastructure.sh            # Start Docker containers + backend
./stop_infrastructure.sh             # Stop Docker containers
```

**Services:**
- **Keycloak:** `localhost:8082` (admin/admin) — realm `plataformaInstitucional` pre-configured
- **MongoDB:** `localhost:27017` (database: `colegio`) — requires auth (`admin/admin123`)

**Test Users:**
- `admin/admin123` (role: administrador)
- `profesor/profesor123` (role: docente)
- `estudiante/estudiante123` (role: estudiante)

### Backend Virtual Environment
All backend services run inside a shared Python virtual environment:
```bash
source backend/.venv/bin/activate    # Activate .venv
python backend/<service>/app.py &    # Run individual service
```

**Dependencies installed in `backend/.venv`:**
```bash
pip install Flask Flask-CORS python-keycloak pymongo PyJWT zappa Werkzeug setuptools==69.5.1 reportlab pillow
```

**Critical dependency notes:**
- `setuptools==69.5.1` is **required** — modern setuptools 82+ removed `pkg_resources`, breaking `python-keycloak`
- `reportlab` + `pillow` are required for PDF generation in `students_service`
- `mongo:4.4` is used in Docker (not 7.0) because the host CPU lacks AVX support required by MongoDB 5.0+
- `docker-compose.yml` removed obsolete `version: '3.8'` attribute for Docker Compose v2 compatibility

### Environment Variables
Backend services read from `.env` in the project root:
```
MONGODB_URI=mongodb://admin:admin123@localhost:27017/colegio?authSource=admin
KEYCLOAK_SERVER_URL=http://localhost:8082
KEYCLOAK_REALM=plataformaInstitucional
KEYCLOAK_CLIENT_ID=plataforma-client
KEYCLOAK_CLIENT_SECRET=<secret>
```

`start_backend.sh` automatically loads `.env` variables before starting services.
