import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../services/alert.service';

@Component({
  selector: 'app-course-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-form.html',
  styleUrls: ['./course-form.css']
})
export class CourseFormComponent implements OnInit {
  isEdit = false;
  assignmentId: string | null = null;
  loading = false;
  loadingGroups = false;
  loadingCourses = false;
  loadingTeachers = false;
  loadingSchedule = false;
  error: string | null = null;
  success: string | null = null;

  // ✅ NUEVO MODELO DE DATOS
  formData = {
    group_id: '',        // Grupo al que se asigna
    course_id: '',       // Asignatura (curso base)
    teacher_id: '',      // Docente
    periodo: '1',        // Período académico
    salon: '',           // Salón asignado
    anio_lectivo: '2025'
  };

  // Listas de datos
  grupos: any[] = [];
  cursos: any[] = [];  // Asignaturas base (Matemáticas, Español, etc.)
  teachers: any[] = [];
  horarioGrupo: any[] = [];
  bloquesDisponibles: any[] = [];

  periodos = ['1', '2', '3', '4'];
  diasSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadGroups();
    this.loadCourses();
    this.loadTeachers();

    this.assignmentId = this.route.snapshot.paramMap.get('id');
    
    if (this.assignmentId) {
      this.isEdit = true;
      this.loadAssignmentData();
    }
  }

  loadGroups(): void {
    this.loadingGroups = true;
    this.api.getGroups().subscribe({
      next: (response: any) => {
        console.log('✅ Grupos cargados:', response);
        if (response.success) {
          this.grupos = response.data || [];
        }
        this.loadingGroups = false;
      },
      error: (err) => {
        console.error('❌ Error cargando grupos:', err);
        this.alertService.error('Error al cargar grupos');
        this.loadingGroups = false;
      }
    });
  }

  loadCourses(): void {
    this.loadingCourses = true;
    this.api.getCourses().subscribe({
      next: (response: any) => {
        console.log('✅ Cursos cargados:', response);
        if (response.success) {
          this.cursos = response.data || [];
        }
        this.loadingCourses = false;
      },
      error: (err) => {
        console.error('❌ Error cargando cursos:', err);
        this.alertService.error('Error al cargar asignaturas');
        this.loadingCourses = false;
      }
    });
  }

  loadTeachers(): void {
    this.loadingTeachers = true;
    this.api.getAdminTeachers({ estado: 'activo' }).subscribe({
      next: (response: any) => {
        this.teachers = response.teachers || [];
        this.loadingTeachers = false;
      },
      error: (err) => {
        console.error('❌ Error cargando docentes:', err);
        this.loadingTeachers = false;
      }
    });
  }

  onGrupoChange(): void {
    if (this.formData.group_id) {
      this.loadGroupSchedule(this.formData.group_id);
    }
  }

  loadGroupSchedule(groupId: string): void {
    this.loadingSchedule = true;
    this.api.getGroupSchedule(groupId).subscribe({
      next: (response: any) => {
        console.log('✅ Horario del grupo:', response);
        if (response.success) {
          this.horarioGrupo = response.bloques || [];
          this.calcularBloquesDisponibles();
        }
        this.loadingSchedule = false;
      },
      error: (err) => {
        console.error('❌ Error cargando horario:', err);
        this.horarioGrupo = [];
        this.loadingSchedule = false;
      }
    });
  }

  calcularBloquesDisponibles(): void {
    const horariosCompletos = new Set<string>();
    
    this.horarioGrupo.forEach(bloque => {
      if (bloque.id_asignacion && bloque.tipo === 'clase') {
        const key = `${bloque.dia}-${bloque.hora_inicio}`;
        horariosCompletos.add(key);
      }
    });
    
    this.bloquesDisponibles = this.horarioGrupo.filter(bloque => {
      const key = `${bloque.dia}-${bloque.hora_inicio}`;
      return bloque.tipo === 'libre' || (!horariosCompletos.has(key) && bloque.tipo !== 'descanso');
    });
    
    console.log('📅 Bloques disponibles:', this.bloquesDisponibles);
  }

  loadAssignmentData(): void {
    // TODO: Implementar carga de asignación existente para edición
    console.log('Cargar asignación:', this.assignmentId);
  }

  validateForm(): boolean {
    const { group_id, course_id, teacher_id, periodo } = this.formData;
    
    if (!group_id || !course_id || !teacher_id || !periodo) {
      this.error = 'Por favor complete todos los campos obligatorios';
      return false;
    }

    return true;
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    this.api.createAssignment(this.formData).subscribe({
      next: (response: any) => {
        console.log('✅ Asignación creada:', response);
        this.alertService.success('Asignación docente creada exitosamente');
        this.loading = false;
        
        setTimeout(() => {
          this.router.navigate(['/dashboard/admin']);
        }, 1500);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.alertService.error(err.error?.error || 'Error al crear asignación');
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/admin']);
  }

  resetForm(): void {
    this.formData = {
      group_id: '',
      course_id: '',
      teacher_id: '',
      periodo: '1',
      salon: '',
      anio_lectivo: '2025'
    };
    this.horarioGrupo = [];
    this.bloquesDisponibles = [];
    this.error = null;
    this.success = null;
  }

  // ==========================================
  //   MÉTODOS HELPER PARA EL HORARIO
  // ==========================================

  getUniqueHours(): string[] {
    const hours = new Set<string>();
    this.horarioGrupo.forEach(bloque => {
      hours.add(`${bloque.hora_inicio}-${bloque.hora_fin}`);
    });
    return Array.from(hours).sort();
  }

  getBlockForTime(dia: string, hora: string): any {
    const [hora_inicio, hora_fin] = hora.split('-');
    return this.horarioGrupo.find(b => 
      b.dia === dia && 
      b.hora_inicio === hora_inicio && 
      b.hora_fin === hora_fin
    );
  }

  getBlockDisplay(dia: string, hora: string): string {
    const bloque = this.getBlockForTime(dia, hora);
    
    if (!bloque) return '-';
    
    if (bloque.tipo === 'descanso') return 'DESCANSO';
    if (bloque.tipo === 'libre') return '-';
    if (bloque.tipo === 'clase' && bloque.curso_info) {
      return bloque.curso_info.nombre_curso || 'Ocupado';
    }
    
    return '-';
  }
}