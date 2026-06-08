import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../services/alert.service';

interface Calificacion {
  tipo: string;
  nota: number;
  nota_maxima: number;
  peso: number;
  fecha_eval: string;
  comentarios?: string;
  assignment_id?: string;
  periodo?: string;
  index?: number;
}

interface Estudiante {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  grades: Calificacion[];
  average: number;
  // Campos para edición temporal
  nota1?: number;
  nota2?: number;
  nota3?: number;
  observaciones?: string;
  nota1_index?: number;
  nota2_index?: number;
  nota3_index?: number;
  nota1_assignment_id?: string;
  nota2_assignment_id?: string;
  nota3_assignment_id?: string;
}

@Component({
  selector: 'app-grades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grades.html',
  styleUrls: ['./grades.css']
})
export default class GradesComponent implements OnInit {
  // Datos del curso seleccionado
  cursoSeleccionado: any = null;
  periodoSeleccionado: string = '1';

  // Listas
  grupos: any[] = [];
  periodos = ['1', '2', '3', '4'];
  estudiantes: Estudiante[] = [];

  // Estados
  loading = false;
  guardando = false;
  error: string | null = null;

  // Tipos de evaluación
  tiposEvaluacion = ['Parcial', 'Taller', 'Quiz', 'Proyecto', 'Final'];
  tipoEvaluacionSeleccionado = 'Parcial';
  pesoEvaluacion = 0.33;

  constructor(
    private router: Router,
    private api: ApiService,
    private alertService: AlertService
  ) { }

  ngOnInit() {
    this.cargarGrupos();
  }

  cargarGrupos() {
    this.loading = true;
    this.api.getTeacherGroups().subscribe({
      next: (res: any) => {
        if (res.success && res.groups) {
          this.grupos = res.groups;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando grupos:', err);
        this.error = 'Error al cargar grupos';
        this.loading = false;
      }
    });
  }

  onGrupoChange() {
    if (this.cursoSeleccionado) {
      this.cargarCalificaciones();
    }
  }

  cargarCalificaciones() {
    if (!this.cursoSeleccionado) {
      console.warn('No hay curso seleccionado, no se cargan calificaciones');
      return;
    }
    this.loading = true;
    this.error = null;

    this.api.getCourseGrades(this.cursoSeleccionado._id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.estudiantes = res.students.map((student: any) => {
            const grades: Calificacion[] = student.grades || [];
            return {
              enrollment_id: student.enrollment_id,
              student_id: student.student_id,
              student_name: student.student_name,
              student_code: student.student_code,
              grades: grades,
              average: student.average,
              nota1: grades[0]?.nota || 0,
              nota2: grades[1]?.nota || 0,
              nota3: grades[2]?.nota || 0,
              nota1_index: grades[0]?.index !== undefined ? grades[0].index : -1,
              nota2_index: grades[1]?.index !== undefined ? grades[1].index : -1,
              nota3_index: grades[2]?.index !== undefined ? grades[2].index : -1,
              nota1_assignment_id: grades[0]?.assignment_id || undefined,
              nota2_assignment_id: grades[1]?.assignment_id || undefined,
              nota3_assignment_id: grades[2]?.assignment_id || undefined,
              observaciones: grades[grades.length - 1]?.comentarios || ''
            };
          });
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando calificaciones:', err);
        this.error = 'Error al cargar calificaciones';
        this.loading = false;
      }
    });
  }

  calcularPromediosAuto() {
    this.estudiantes = this.estudiantes.map(est => {
      const nota1 = est.nota1 || 0;
      const nota2 = est.nota2 || 0;
      const nota3 = est.nota3 || 0;
      const promedio = Number(((nota1 + nota2 + nota3) / 3).toFixed(2));
      return { ...est, average: promedio };
    });
  }

  guardarCalificaciones() {
    const tieneValor = (nota: number | undefined) =>
      nota !== undefined && nota !== null && !Number.isNaN(nota);

    // Validar notas (incluye 0 como válido)
    const notasInvalidas = this.estudiantes.some(est =>
      (tieneValor(est.nota1) && (est.nota1! < 0 || est.nota1! > 5)) ||
      (tieneValor(est.nota2) && (est.nota2! < 0 || est.nota2! > 5)) ||
      (tieneValor(est.nota3) && (est.nota3! < 0 || est.nota3! > 5))
    );

    if (notasInvalidas) {
      this.alertService.error('Las notas deben estar entre 0.0 y 5.0');
      return;
    }

    this.guardando = true;
    this.calcularPromediosAuto();

    const gradesToUpload = this.estudiantes
      .filter(est => tieneValor(est.nota1) || tieneValor(est.nota2) || tieneValor(est.nota3))
      .flatMap(est => {
        const grades: Array<{
          enrollment_id: string;
          nota: number;
          comentarios: string;
          grade_index?: number;
          assignment_id?: string;
        }> = [];
        if (tieneValor(est.nota1)) {
          grades.push({
            enrollment_id: est.enrollment_id,
            nota: est.nota1!,
            comentarios: est.observaciones || '',
            grade_index: est.nota1_index! >= 0 ? est.nota1_index : undefined,
            assignment_id: est.nota1_assignment_id || undefined
          });
        }
        if (tieneValor(est.nota2)) {
          grades.push({
            enrollment_id: est.enrollment_id,
            nota: est.nota2!,
            comentarios: est.observaciones || '',
            grade_index: est.nota2_index! >= 0 ? est.nota2_index : undefined,
            assignment_id: est.nota2_assignment_id || undefined
          });
        }
        if (tieneValor(est.nota3)) {
          grades.push({
            enrollment_id: est.enrollment_id,
            nota: est.nota3!,
            comentarios: est.observaciones || '',
            grade_index: est.nota3_index! >= 0 ? est.nota3_index : undefined,
            assignment_id: est.nota3_assignment_id || undefined
          });
        }
        return grades;
      });

    if (gradesToUpload.length === 0) {
      this.alertService.warning('No hay calificaciones para guardar');
      this.guardando = false;
      return;
    }

    this.api.bulkUploadGrades({
      course_id: this.cursoSeleccionado._id,
      periodo: this.periodoSeleccionado,
      tipo: this.tipoEvaluacionSeleccionado,
      peso: this.pesoEvaluacion,
      grades: gradesToUpload
    }).subscribe({
      next: (res: any) => {
        this.guardando = false;
        if (res.success) {
          this.alertService.success(
            `Calificaciones guardadas: ${res.successful} exitosas, ${res.failed} fallidas`
          );
          this.cargarCalificaciones();
        }
      },
      error: (err) => {
        console.error('Error guardando calificaciones:', err);
        this.alertService.error('Error al guardar calificaciones');
        this.guardando = false;
      }
    });
  }

  descargarReporteGrupo() {
    if (!this.cursoSeleccionado) {
      this.alertService.warning('Selecciona un grupo primero');
      return;
    }
    this.api.downloadGroupReportPDF(this.cursoSeleccionado._id, this.periodoSeleccionado)
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `reporte_${this.cursoSeleccionado.name}_periodo_${this.periodoSeleccionado}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('Error descargando reporte:', err);
          this.alertService.error('Error al descargar el reporte');
        }
      });
  }

  descargarBoletines() {
    if (!this.cursoSeleccionado) {
      this.alertService.warning('Selecciona un grupo primero');
      return;
    }
    this.api.downloadGroupCardsPDF(this.cursoSeleccionado._id, this.periodoSeleccionado)
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `boletines_${this.cursoSeleccionado.name}_periodo_${this.periodoSeleccionado}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('Error descargando boletines:', err);
          this.alertService.error('Error al descargar los boletines');
        }
      });
  }

  goBack() {
    this.router.navigate(['/dashboard/teacher']);
  }

  trackByEstudiante(index: number, estudiante: any): string { return estudiante.student_id || estudiante.enrollment_id || index; }
  trackByGrupo(index: number, grupo: any): string { return grupo._id || index; }
  trackByPeriodo(index: number, periodo: string): string { return periodo; }
}
