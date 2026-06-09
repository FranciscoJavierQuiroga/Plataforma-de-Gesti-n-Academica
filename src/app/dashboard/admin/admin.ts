import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';

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
  activeView: 'dashboard' | 'students' | 'courses' | 'groups' | 'enrollments' | 'reports' | 'periodos' = 'dashboard';

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

  // Grupos
  grupos: any[] = [];
  estudiantesGrupo: any[] = [];
  selectedGroup: any = null;
  loadingGroups = false;

  // Reportes
  selectedReport: string | null = null;
  reportData: any = null;
  loadingReport = false;

  // Periodos
  periodos: any[] = [];
  loadingPeriodos = false;
  showPeriodoForm = false;
  editingPeriodo = false;
  savingPeriodo = false;
  currentYear = new Date().getFullYear();
  periodoForm = {
    _id: '',
    nombre: '',
    periodo: '1',
    anio_lectivo: String(new Date().getFullYear()),
    fecha_inicio: '',
    fecha_fin: '',
    fecha_limite_calificaciones: '',
    nota_minima_aprobacion: 3.0,
    limite_materias_reprobadas: 3
  };

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService
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
  changeView(view: 'dashboard' | 'students' | 'courses' | 'groups' | 'enrollments' | 'reports' | 'periodos'): void {
    console.log(`🔄 Cambiando a vista: ${view}`);
    this.activeView = view;
    this.selectedReport = null;
    this.reportData = null;

    if (view === 'groups') {
      this.loadGroups();
      this.loadGroupStudentsList();
    }
    if (view === 'periodos') {
      this.loadPeriodos();
    }
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

  // ==========================================
  //   GRUPOS
  // ==========================================

  loadGroups(): void {
    this.loadingGroups = true;
    this.api.getGroups().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.grupos = res.data || [];
        } else {
          this.grupos = [];
        }
        this.loadingGroups = false;
      },
      error: (err: any) => {
        console.error('❌ Error cargando grupos:', err);
        this.grupos = [];
        this.loadingGroups = false;
      }
    });
  }

  loadGroupStudentsList(): void {
    this.api.getAdminStudents().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.estudiantesGrupo = res.students || [];
        } else {
          this.estudiantesGrupo = [];
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando estudiantes:', err);
        this.estudiantesGrupo = [];
      }
    });
  }

  selectGroup(grupo: any): void {
    this.selectedGroup = grupo;
    this.loadGroupStudents(grupo._id);
  }

  loadGroupStudents(groupId: string): void {
    this.api.getGroupStudents(groupId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.estudiantesGrupo = res.estudiantes || [];
        } else {
          this.estudiantesGrupo = [];
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando estudiantes del grupo:', err);
        this.alertService.error('Error al cargar estudiantes del grupo');
        this.estudiantesGrupo = [];
      }
    });
  }

  async assignStudent(studentId: string): Promise<void> {
    if (!this.selectedGroup) {
      this.alertService.warning('Seleccione un grupo primero');
      return;
    }

    const confirmed = await this.alertService.confirm({
      title: '¿Asignar estudiante?',
      message: `¿Desea asignar este estudiante al grupo ${this.selectedGroup.nombre_grupo}?`,
      confirmText: 'Sí, asignar',
      cancelText: 'Cancelar'
    });

    if (confirmed) {
      this.api.assignStudentToGroup(this.selectedGroup._id, studentId).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.alertService.success(
              `Estudiante asignado y matriculado en ${res.matriculas_creadas} cursos`
            );
            this.loadGroupStudents(this.selectedGroup._id);
            this.loadGroupStudentsList();
          }
        },
        error: (err: any) => {
          console.error('❌ Error asignando estudiante:', err);
          this.alertService.error('Error al asignar estudiante');
        }
      });
    }
  }

  // ==========================================
  //   PERIODOS
  // ==========================================

  loadPeriodos(): void {
    this.loadingPeriodos = true;
    this.api.getAdminPeriodos().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.periodos = res.periodos || [];
        } else {
          this.periodos = [];
        }
        this.loadingPeriodos = false;
      },
      error: (err: any) => {
        console.error('❌ Error cargando periodos:', err);
        this.periodos = [];
        this.loadingPeriodos = false;
      }
    });
  }

  cancelPeriodoForm(): void {
    this.showPeriodoForm = false;
    this.editingPeriodo = false;
    this.resetPeriodoForm();
  }

  resetPeriodoForm(): void {
    this.periodoForm = {
      _id: '',
      nombre: '',
      periodo: '1',
      anio_lectivo: String(this.currentYear),
      fecha_inicio: '',
      fecha_fin: '',
      fecha_limite_calificaciones: '',
      nota_minima_aprobacion: 3.0,
      limite_materias_reprobadas: 3
    };
  }

  editarPeriodo(periodo: any): void {
    this.periodoForm = {
      _id: periodo._id,
      nombre: periodo.nombre,
      periodo: periodo.periodo,
      anio_lectivo: periodo.anio_lectivo,
      fecha_inicio: this.formatDateForInput(periodo.fecha_inicio),
      fecha_fin: this.formatDateForInput(periodo.fecha_fin),
      fecha_limite_calificaciones: this.formatDateForInput(periodo.fecha_limite_calificaciones),
      nota_minima_aprobacion: periodo.nota_minima_aprobacion,
      limite_materias_reprobadas: periodo.limite_materias_reprobadas
    };
    this.editingPeriodo = true;
    this.showPeriodoForm = true;
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  savePeriodo(): void {
    if (!this.periodoForm.nombre || !this.periodoForm.fecha_inicio || !this.periodoForm.fecha_fin) {
      this.alertService.warning('Complete todos los campos obligatorios');
      return;
    }

    this.savingPeriodo = true;

    const data = {
      nombre: this.periodoForm.nombre,
      periodo: this.periodoForm.periodo,
      anio_lectivo: this.periodoForm.anio_lectivo,
      fecha_inicio: this.periodoForm.fecha_inicio,
      fecha_fin: this.periodoForm.fecha_fin,
      fecha_limite_calificaciones: this.periodoForm.fecha_limite_calificaciones || this.periodoForm.fecha_fin,
      nota_minima_aprobacion: this.periodoForm.nota_minima_aprobacion,
      limite_materias_reprobadas: this.periodoForm.limite_materias_reprobadas
    };

    if (this.editingPeriodo && this.periodoForm._id) {
      this.api.updatePeriodo(this.periodoForm._id, data).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.alertService.success('Periodo actualizado exitosamente');
            this.showPeriodoForm = false;
            this.editingPeriodo = false;
            this.resetPeriodoForm();
            this.loadPeriodos();
          }
          this.savingPeriodo = false;
        },
        error: (err: any) => {
          console.error('❌ Error actualizando periodo:', err);
          this.alertService.error('Error al actualizar el periodo');
          this.savingPeriodo = false;
        }
      });
    } else {
      this.api.createPeriodo(data).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.alertService.success('Periodo creado exitosamente');
            this.showPeriodoForm = false;
            this.resetPeriodoForm();
            this.loadPeriodos();
          }
          this.savingPeriodo = false;
        },
        error: (err: any) => {
          console.error('❌ Error creando periodo:', err);
          this.alertService.error('Error al crear el periodo');
          this.savingPeriodo = false;
        }
      });
    }
  }

  activarPeriodo(id: string): void {
    this.api.activarPeriodo(id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.alertService.success('Periodo activado exitosamente');
          this.loadPeriodos();
        }
      },
      error: (err: any) => {
        console.error('❌ Error activando periodo:', err);
        this.alertService.error('Error al activar el periodo');
      }
    });
  }

  eliminarPeriodo(id: string): void {
    if (confirm('¿Estás seguro de eliminar este periodo?')) {
      this.api.deletePeriodo(id).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.alertService.success('Periodo eliminado exitosamente');
            this.loadPeriodos();
          }
        },
        error: (err: any) => {
          console.error('❌ Error eliminando periodo:', err);
          this.alertService.error('Error al eliminar el periodo');
        }
      });
    }
  }

  trackByPeriodo(index: number, periodo: any): string {
    return periodo._id || index;
  }

  trackByStudent(index: number, student: any): string {
    return student._id || index;
  }
  trackByCourse(index: number, course: any): string {
    return course._id || index;
  }
  trackByEnrollment(index: number, enrollment: any): string {
    return enrollment._id || index;
  }
  trackByGrupo(index: number, grupo: any): string {
    return grupo._id || index;
  }
  trackByEstudiante(index: number, estudiante: any): string {
    return estudiante._id || index;
  }
  trackByReportData(index: number, item: any): string {
    return item._id || item.id || index;
  }
}