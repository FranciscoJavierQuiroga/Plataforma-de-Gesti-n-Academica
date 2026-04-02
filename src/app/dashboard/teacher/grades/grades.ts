import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

interface Calificacion {
  tipo: string;
  nota: number;
  nota_maxima: number;
  peso: number;
  fecha_eval: string;
  comentarios?: string;
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
    private api: ApiService
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
      console.warn('⚠️ No hay curso seleccionado, no se cargan calificaciones');
      return; // ✅ Esto debe estar
    }
    this.loading = true;
    this.error = null;

    this.api.getCourseGrades(this.cursoSeleccionado._id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.estudiantes = res.students.map((student: any) => {
            const grades = student.grades || [];
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
              nota1_index: grades[0] !== undefined ? 0 : -1,
              nota2_index: grades[1] !== undefined ? 1 : -1,
              nota3_index: grades[2] !== undefined ? 2 : -1,
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
      alert('Error: Las notas deben estar entre 0.0 y 5.0');
      return;
    }

    this.guardando = true;
    this.calcularPromediosAuto();

    const gradesToUpload = this.estudiantes
      .filter(est => tieneValor(est.nota1) || tieneValor(est.nota2) || tieneValor(est.nota3))
      .flatMap(est => {
        const grades: Array<{ enrollment_id: string; nota: number; comentarios: string; grade_index?: number }> = [];
        if (tieneValor(est.nota1)) {
          grades.push({
            enrollment_id: est.enrollment_id,
            nota: est.nota1!,
            comentarios: est.observaciones || '',
            grade_index: est.nota1_index! >= 0 ? est.nota1_index : undefined
          });
        }
        if (tieneValor(est.nota2)) {
          grades.push({
            enrollment_id: est.enrollment_id,
            nota: est.nota2!,
            comentarios: est.observaciones || '',
            grade_index: est.nota2_index! >= 0 ? est.nota2_index : undefined
          });
        }
        if (tieneValor(est.nota3)) {
          grades.push({
            enrollment_id: est.enrollment_id,
            nota: est.nota3!,
            comentarios: est.observaciones || '',
            grade_index: est.nota3_index! >= 0 ? est.nota3_index : undefined
          });
        }
        return grades;
      });

    if (gradesToUpload.length === 0) {
      alert('No hay calificaciones para guardar');
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
          alert(`Calificaciones guardadas exitosamente.\n\nExitosas: ${res.successful}\nFallidas: ${res.failed}`);
          this.cargarCalificaciones();
        }
      },
      error: (err) => {
        console.error('Error guardando calificaciones:', err);
        alert('Error al guardar calificaciones');
        this.guardando = false;
      }
    });
  }

  exportarPDF() {
    alert('Funcionalidad de exportación a PDF en desarrollo.\n\nSe implementará similar a los boletines de estudiantes.');
  }

  goBack() {
    this.router.navigate(['/dashboard/teacher']);
  }
}