import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

interface Estudiante {
  id_estudiante: string;
  codigo: string;
  nombre: string;
  estado: 'presente' | 'ausente' | 'tarde' | 'excusa';
  observaciones: string;
}

interface Grupo {
  _id: string;
  name: string;
  codigo: string;
  periodo: string;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './attendance.html',
  styleUrls: ['./attendance.css']
})
export default class AttendanceComponent implements OnInit {
  grupos: Grupo[] = [];
  periodos = ['1', '2', '3', '4'];
  grupoSeleccionado: Grupo | null = null;
  periodoSeleccionado: string | null = null;
  fechaSeleccionada: string = new Date().toISOString().slice(0, 10);
  maxFecha: string = new Date().toISOString().slice(0, 10); // ✅ AGREGAR ESTA LÍNEA

  estudiantes: Estudiante[] = [];
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Materias
  asignaciones: any[] = [];
  materiaSeleccionada: any = null;
  isHomeroomTeacher = false;
  loadingAssignments = false;
  readonlyOnly = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarGrupos();
  }

  cargarGrupos() {
    this.loading = true;
    this.api.getTeacherGroups().subscribe({
      next: (res: any) => {
        if (res.success && res.groups) {
          this.grupos = res.groups.map((g: any) => ({
            _id: g._id,
            name: g.name,
            codigo: g.codigo,
            periodo: g.periodo
          }));
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando grupos:', err);
        this.error = 'Error al cargar los grupos';
        this.loading = false;
      }
    });
  }

  onGrupoChange() {
    this.asignaciones = [];
    this.materiaSeleccionada = null;
    this.estudiantes = [];
    this.isHomeroomTeacher = false;
    this.readonlyOnly = false;
    if (this.grupoSeleccionado) {
      this.periodoSeleccionado = this.grupoSeleccionado.periodo;
      this.cargarAsignaciones();
    }
  }

  cargarAsignaciones() {
    if (!this.grupoSeleccionado) return;
    this.loadingAssignments = true;
    this.api.getTeacherGroupAssignments(this.grupoSeleccionado._id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.asignaciones = res.assignments || [];
          this.isHomeroomTeacher = res.is_homeroom_teacher || false;
          if (this.asignaciones.length === 1) {
            this.materiaSeleccionada = this.asignaciones[0];
            this.cargarEstudiantes();
          }
        }
        this.loadingAssignments = false;
      },
      error: (err) => {
        console.error('Error cargando asignaciones:', err);
        this.loadingAssignments = false;
      }
    });
  }

  onMateriaChange() {
    if (this.materiaSeleccionada) {
      this.readonlyOnly = this.isHomeroomTeacher && !this.materiaSeleccionada.is_own;
      this.cargarEstudiantes();
    } else {
      this.estudiantes = [];
    }
  }

  cargarEstudiantes() {
    if (!this.grupoSeleccionado || !this.materiaSeleccionada) return;

    this.loading = true;
    this.error = null;

    const courseId = this.materiaSeleccionada?.id_curso;
    this.api.getAttendance(this.grupoSeleccionado._id, this.fechaSeleccionada, courseId).subscribe({
      next: (res: any) => {
        this.isHomeroomTeacher = res.is_homeroom_teacher || false;
        if (res.success && res.attendance && res.attendance.registros) {
          this.estudiantes = res.attendance.registros.map((reg: any) => ({
            id_estudiante: String(reg.id_estudiante),
            codigo: reg.estudiante_info?.codigo_est || '',
            nombre: `${reg.estudiante_info?.nombres || ''} ${reg.estudiante_info?.apellidos || ''}`,
            estado: reg.estado,
            observaciones: reg.observaciones || ''
          }));
          this.loading = false;
        } else {
          this.cargarEstudiantesDelCurso();
        }
      },
      error: (err: any) => {
        console.error('Error cargando asistencia:', err);
        this.cargarEstudiantesDelCurso();
      }
    });
  }

  cargarEstudiantesDelCurso() {
    if (!this.grupoSeleccionado || !this.materiaSeleccionada) return;

    this.api.getCourseGrades(this.grupoSeleccionado._id, this.materiaSeleccionada.id_curso).subscribe({
      next: (res: any) => {
        if (res.success && res.students) {
          this.estudiantes = res.students.map((student: any) => ({
            id_estudiante: student.student_id,
            codigo: student.student_code,
            nombre: student.student_name,
            estado: 'presente' as const,
            observaciones: ''
          }));
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando estudiantes:', err);
        this.error = 'Error al cargar estudiantes del curso';
        this.loading = false;
      }
    });
  }

  onFechaChange() {
    if (this.grupoSeleccionado && this.materiaSeleccionada) {
      this.cargarEstudiantes();
    }
  }

  marcarTodos(estado: 'presente' | 'ausente') {
    this.estudiantes.forEach(e => e.estado = estado);
  }

  guardarAsistencia() {
    if (!this.grupoSeleccionado || !this.materiaSeleccionada || this.estudiantes.length === 0) {
      this.error = 'Selecciona un grupo y una materia, y asegúrate de tener estudiantes listados';
      return;
    }

    if (this.readonlyOnly) {
      this.error = 'No puedes editar asistencia de materias que no impartes';
      return;
    }

    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const datos = {
      group_id: this.grupoSeleccionado._id,
      course_id: this.materiaSeleccionada.id_curso,
      fecha: this.fechaSeleccionada,
      periodo: this.periodoSeleccionado || this.grupoSeleccionado.periodo,
      registros: this.estudiantes.map(e => ({
        id_estudiante: String(e.id_estudiante),
        estado: e.estado,
        observaciones: e.observaciones
      }))
    };

    this.api.saveAttendance(datos).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = res.message || 'Asistencia guardada exitosamente';
          setTimeout(() => this.successMessage = null, 3000);
        }
        this.saving = false;
      },
      error: (err: any) => {
        console.error('Error guardando asistencia:', err);
        this.error = err.error?.error || 'Error al guardar la asistencia';
        this.saving = false;
      }
    });
  }

  getResumen() {
    const presentes = this.estudiantes.filter(e => e.estado === 'presente').length;
    const ausentes = this.estudiantes.filter(e => e.estado === 'ausente').length;
    const tardes = this.estudiantes.filter(e => e.estado === 'tarde').length;
    const excusas = this.estudiantes.filter(e => e.estado === 'excusa').length;

    return { presentes, ausentes, tardes, excusas, total: this.estudiantes.length };
  }

  trackByStudent(index: number, student: any): string { return student.id_estudiante || student.codigo || index; }
}