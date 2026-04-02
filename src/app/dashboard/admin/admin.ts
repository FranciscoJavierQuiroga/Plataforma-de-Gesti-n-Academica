import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export default class AdminComponent implements OnInit {
  loading = false;
  error: string | null = null;
  activeView: 'dashboard' | 'students' | 'courses' | 'enrollments' | 'reports' = 'dashboard';

  adminName = 'Administrador';

  // Filtros
  enrollmentFilters = {
    estado: '',
    grado: '',
    periodo: ''
  };

  // Estadísticas
  stats = {
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    pendingEnrollments: 0
  };

  // Listas
  students: any[] = [];
  courses: any[] = [];
  enrollments: any[] = [];

  // Reportes
  selectedReport: string | null = null;
  reportData: any = null;
  loadingReport = false;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🚀 AdminComponent inicializado');
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      console.log('📊 Cargando datos del dashboard...');

      // Cargar en paralelo
      await Promise.all([
        this.loadStudents(),
        this.loadCourses(),
        this.loadEnrollments(),
        this.loadTeachers()
      ]);

      // Calcular estadísticas
      this.updateStats();

      console.log('✅ Dashboard cargado exitosamente');
    } catch (err: any) {
      console.error('❌ Error cargando dashboard:', err);
      this.error = err.message || 'Error cargando datos del dashboard';
    } finally {
      this.loading = false;
    }
  }

  loadStudents(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('👥 Cargando estudiantes...');
      
      this.api.getAdminStudents().subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta de estudiantes:', response);
          
          if (response.success) {
            this.students = response.students || [];
            console.log(`📚 ${this.students.length} estudiantes cargados`);
          } else {
            console.warn('⚠️ Respuesta sin success:', response);
            this.students = [];
          }
          resolve();
        },
        error: (err) => {
          console.error('❌ Error cargando estudiantes:', err);
          this.students = [];
          reject(err);
        }
      });
    });
  }

  loadCourses(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📚 Cargando cursos...');
      
      this.api.getAdminCourses().subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta de cursos:', response);
          
          if (response.success) {
            this.courses = response.courses || [];
            console.log(`📖 ${this.courses.length} cursos cargados`);
          } else {
            console.warn('⚠️ Respuesta sin success:', response);
            this.courses = [];
          }
          resolve();
        },
        error: (err) => {
          console.error('❌ Error cargando cursos:', err);
          this.courses = [];
          reject(err);
        }
      });
    });
  }

  loadTeachers(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('👨‍🏫 Cargando docentes...');
    
    this.api.getAdminTeachers().subscribe({
      next: (response: any) => {
        console.log('✅ Respuesta de docentes:', response);
        
        if (response.success) {
          const teachers = response.teachers || [];
          this.stats.totalTeachers = teachers.length;
          console.log(`👨‍🏫 ${teachers.length} docentes cargados`);
        } else {
          console.warn('⚠️ Respuesta sin success:', response);
          this.stats.totalTeachers = 0;
        }
        resolve();
      },
      error: (err) => {
        console.error('❌ Error cargando docentes:', err);
        this.stats.totalTeachers = 0;
        reject(err);
      }
    });
  });
}
  loadEnrollments(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔍 Cargando matrículas con filtros:', this.enrollmentFilters);
      
      this.api.getAdminEnrollments(this.enrollmentFilters).subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta de matrículas:', response);
          
          if (response.success) {
            this.enrollments = response.enrollments || [];
            console.log(`📋 ${this.enrollments.length} matrículas cargadas`);
            
            // Mostrar ejemplo
            if (this.enrollments.length > 0) {
              const ejemplo = this.enrollments[0];
              console.log('📋 Ejemplo de matrícula:', {
                estudiante: ejemplo.estudiante_info?.nombres,
                grupo: ejemplo.grupo_info?.nombre_grupo,
                estado: ejemplo.estado
              });
            }
          } else {
            console.warn('⚠️ Respuesta sin success:', response);
            this.enrollments = [];
          }
          resolve();
        },
        error: (err) => {
          console.error('❌ Error cargando matrículas:', err);
          this.enrollments = [];
          reject(err);
        }
      });
    });
  }

  updateStats(): void {
  this.stats.totalStudents = this.students.length;
  this.stats.totalCourses = this.courses.length;
  this.stats.totalEnrollments = this.enrollments.length;
  this.stats.pendingEnrollments = this.enrollments.filter(
    e => e.estado === 'pendiente'
  ).length;
  
  // ✅ NO sobrescribir totalTeachers aquí, ya se carga en loadTeachers()

  console.log('📊 Estadísticas actualizadas:', this.stats);
}
  changeView(view: 'dashboard' | 'students' | 'courses' | 'enrollments' | 'reports'): void {
    console.log(`🔄 Cambiando a vista: ${view}`);
    this.activeView = view;
    this.selectedReport = null;
    this.reportData = null;
  }

  // ✅ MÉTODO HELPER PARA FORMATEAR FECHA
  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    
    try {
      // Si es un objeto Timestamp de MongoDB { t: number, i: number }
      if (timestamp.t) {
        const date = new Date(timestamp.t * 1000);
        return date.toLocaleDateString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      }
      
      // Si tiene $date (formato JSON de MongoDB)
      if (timestamp.$date) {
        const date = new Date(timestamp.$date);
        return date.toLocaleDateString('es-CO');
      }
      
      // Si es timestamp numérico
      if (typeof timestamp === 'number') {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('es-CO');
      }
      
      // Si ya es string
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        return date.toLocaleDateString('es-CO');
      }
      
      return '-';
    } catch (e) {
      console.error('Error formateando fecha:', e, timestamp);
      return '-';
    }
  }

  // ==========================================
  //   REPORTES
  // ==========================================

  generateReport(reportType: string): void {
    console.log(`📊 Generando reporte: ${reportType}`);
    this.selectedReport = reportType;
    this.reportData = null;
    this.loadingReport = true;

    switch (reportType) {
      case 'students-by-grade':
        this.api.getReportStudentsByGrade().subscribe({
          next: (response: any) => {
            console.log('✅ Reporte estudiantes por grado:', response);
            this.reportData = response.report || [];
            this.loadingReport = false;
          },
          error: (err) => {
            console.error('❌ Error generando reporte:', err);
            this.loadingReport = false;
          }
        });
        break;

      case 'enrollment-history':
        this.api.getReportEnrollmentHistory().subscribe({
          next: (response: any) => {
            console.log('✅ Reporte historial matrículas:', response);
            this.reportData = response.report || [];
            this.loadingReport = false;
          },
          error: (err) => {
            console.error('❌ Error generando reporte:', err);
            this.loadingReport = false;
          }
        });
        break;

      default:
        console.warn('⚠️ Tipo de reporte no reconocido:', reportType);
        this.loadingReport = false;
    }
  }

  // ==========================================
  //   ACCIONES
  // ==========================================

  editStudent(student: any): void {
    console.log('✏️ Editar estudiante:', student);
    this.router.navigate(['/dashboard/admin/students', student._id, 'edit']);
  }

  deleteStudent(student: any): void {
    if (confirm(`¿Eliminar estudiante ${student.nombres} ${student.apellidos}?`)) {
      console.log('🗑️ Eliminar estudiante:', student);
      // TODO: Implementar eliminación
    }
  }

  editCourse(course: any): void {
    console.log('✏️ Editar curso:', course);
    this.router.navigate(['/dashboard/admin/courses', course._id, 'edit']);
  }

  deleteCourse(course: any): void {
    if (confirm(`¿Eliminar curso ${course.nombre_curso}?`)) {
      console.log('🗑️ Eliminar curso:', course);
      // TODO: Implementar eliminación
    }
  }

  logout(): void {
    console.log('👋 Cerrando sesión...');
    this.authService.logout();
    this.router.navigate(['/login']);
  }

    // ==========================================
  //   HELPERS PARA REPORTES
  // ==========================================

  goToReports(): void {
    this.changeView('reports');
  }

  getMaxStudents(data: any[]): number {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(item => item.total_estudiantes || 0));
  }

  getTotalStudents(data: any[]): number {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, item) => sum + (item.total_estudiantes || 0), 0);
  }

  getPercentage(value: number, total: number): string {
    if (total === 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
  }
  getMaxEnrollments(data: any[]): number {
  if (!data || data.length === 0) return 1;
  return Math.max(...data.map(item => item.total_matriculas || 0));
}
}