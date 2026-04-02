import { Routes } from '@angular/router';
import { RoleGuard } from './guards/role-guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { 
    path: 'login', 
    loadComponent: () => import('./authentication/login/login').then(m => m.default) 
  },
  
  // ==========================================
  //   RUTAS DE ESTUDIANTE
  // ==========================================
  {
    path: 'dashboard/student',
    loadComponent: () => import('./dashboard/student/student').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'estudiante' }
  },
  {
    path: 'dashboard/student/boletines',
    loadComponent: () => import('./dashboard/student/boletines/boletines').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'estudiante' }
  },
  {
    path: 'dashboard/student/horario',
    loadComponent: () => import('./dashboard/student/horario/horario').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'estudiante' }
  },
  {
    path: 'dashboard/student/certificados',
    loadComponent: () => import('./dashboard/student/certificados/certificados').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'estudiante' }
  },
  
  // ==========================================
  //   RUTAS DE DOCENTE
  // ==========================================
  {
    path: 'dashboard/teacher',
    loadComponent: () => import('./dashboard/teacher/teacher').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'docente' }
  },
  {
    path: 'dashboard/teacher/attendance',
    loadComponent: () => import('./dashboard/teacher/attendance/attendance').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'docente' }
  },
  {
    path: 'dashboard/teacher/observations',
    loadComponent:() => import('./dashboard/teacher/observations/observations').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'docente'}
  },
  {
    path: 'dashboard/teacher/grades',
    loadComponent: () => import('./dashboard/teacher/grades/grades').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'docente' }
  },
  {
    path: 'dashboard/teacher/group/:id',
    loadComponent: () => import('./dashboard/teacher/group-detail/group-detail').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'docente' }
  },
  
  // ==========================================
  //   RUTAS DE ADMINISTRADOR
  // ==========================================
  {
    path: 'dashboard/admin',
    loadComponent: () => import('./dashboard/admin/admin').then(m => m.default),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/groups',
    loadComponent: () => import('./dashboard/admin/groups/groups.component').then(m => m.AdminGroupsComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/students/new',
    loadComponent: () => import('./dashboard/admin/student-form/student-form').then(m => m.StudentFormComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/students/:id/edit',
    loadComponent: () => import('./dashboard/admin/student-form/student-form').then(m => m.StudentFormComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/courses/new',
    loadComponent: () => import('./dashboard/admin/course-form/course-form').then(m => m.CourseFormComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/courses/:id/edit',
    loadComponent: () => import('./dashboard/admin/course-form/course-form').then(m => m.CourseFormComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/enrollments/new',
    loadComponent: () => import('./dashboard/admin/enrollment-form/enrollment-form').then(m => m.EnrollmentFormComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  {
    path: 'dashboard/admin/reports',
    loadComponent: () => import('./dashboard/admin/reports/reports').then(m => m.ReportsComponent),
    canActivate: [RoleGuard],
    data: { role: 'administrador' }
  },
  
  // ==========================================
  //   OTRAS RUTAS
  // ==========================================
  {
    path: 'unauthorized',
    loadComponent: () => import('./authentication/unauthorized/unauthorized').then(m => m.default)
  },
  { path: '**', redirectTo: '/login' }
];