import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Registrar componentes de Chart.js
Chart.register(...registerables);

interface Report {
  id: string;
  title: string;
  description: string;
  icon: string;
  endpoint: string;
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut';
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  reportData: any = null;
  selectedReport: string | null = null;
  currentChart: Chart | null = null;

  @ViewChild('chartCanvas', { static: false }) chartCanvas?: ElementRef<HTMLCanvasElement>;

  reports: Report[] = [
    {
      id: 'students-by-grade',
      title: 'Estudiantes por Grado',
      description: 'Distribución de estudiantes matriculados por grado académico',
      icon: 'school',
      endpoint: 'students-by-grade',
      chartType: 'bar'
    },
    {
      id: 'performance-by-course',
      title: 'Desempeño por Curso',
      description: 'Promedio de calificaciones por cada curso activo',
      icon: 'trending_up',
      endpoint: 'performance-by-course',
      chartType: 'bar'
    },
    {
      id: 'teacher-workload',
      title: 'Carga Académica Docentes',
      description: 'Cantidad de cursos y estudiantes asignados por docente',
      icon: 'work',
      endpoint: 'teacher-workload',
      chartType: 'bar'
    },
    {
      id: 'enrollment-history',
      title: 'Historial de Matrículas',
      description: 'Evolución de matrículas por periodo académico',
      icon: 'history',
      endpoint: 'enrollment-history',
      chartType: 'line'
    },
    {
      id: 'academic-statistics',
      title: 'Estadísticas Completas',
      description: 'Reporte global con todas las estadísticas del sistema',
      icon: 'analytics',
      endpoint: 'academic-statistics',
      chartType: 'doughnut'
    }
  ];

  constructor(
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  generateReport(report: Report): void {
    this.loading = true;
    this.error = null;
    this.selectedReport = report.id;
    this.reportData = null;

    // Destruir gráfica anterior
    if (this.currentChart) {
      this.currentChart.destroy();
      this.currentChart = null;
    }

    let reportObservable;

    switch(report.endpoint) {
      case 'students-by-grade':
        reportObservable = this.api.getReportStudentsByGrade();
        break;
      case 'performance-by-course':
        reportObservable = this.api.getReportPerformanceByCourse();
        break;
      case 'teacher-workload':
        reportObservable = this.api.getReportTeacherWorkload();
        break;
      case 'enrollment-history':
        reportObservable = this.api.getReportEnrollmentHistory();
        break;
      case 'academic-statistics':
        reportObservable = this.api.getReportAcademicStatistics();
        break;
      default:
        this.loading = false;
        this.error = 'Reporte no disponible';
        return;
    }

    reportObservable.subscribe({
      next: (response: any) => {
        console.log('✅ Reporte generado:', response);
        this.reportData = response;
        this.loading = false;
        
        // Renderizar gráfica después de que la vista se actualice
        setTimeout(() => this.renderChart(report), 100);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = 'Error al generar el reporte';
        this.loading = false;
      }
    });
  }

  renderChart(report: Report): void {
    if (!this.chartCanvas || !this.reportData) return;

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destruir gráfica anterior
    if (this.currentChart) {
      this.currentChart.destroy();
    }

    let chartConfig: ChartConfiguration;

    switch(report.id) {
      case 'students-by-grade':
        chartConfig = this.createStudentsByGradeChart();
        break;
      case 'performance-by-course':
        chartConfig = this.createPerformanceByCourseChart();
        break;
      case 'teacher-workload':
        chartConfig = this.createTeacherWorkloadChart();
        break;
      case 'enrollment-history':
        chartConfig = this.createEnrollmentHistoryChart();
        break;
      case 'academic-statistics':
        chartConfig = this.createAcademicStatisticsChart();
        break;
      default:
        return;
    }

    this.currentChart = new Chart(ctx, chartConfig);
  }

  createStudentsByGradeChart(): ChartConfiguration {
  // ✅ Mapear correctamente los datos del backend
  const reportArray = this.reportData.report || [];
  
  return {
    type: 'bar',
    data: {
      labels: reportArray.map((item: any) => `Grado ${item._id}`),  // ✅ Usar _id en lugar de grado
      datasets: [{
        label: 'Cantidad de Estudiantes',
        data: reportArray.map((item: any) => item.total_estudiantes),  // ✅ Usar total_estudiantes
        backgroundColor: 'rgba(11, 107, 58, 0.7)',
        borderColor: 'rgba(11, 107, 58, 1)',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Distribución de Estudiantes por Grado',
          font: { size: 18, weight: 'bold' },
          color: '#0b6b3a'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  };
}

createPerformanceByCourseChart(): ChartConfiguration {
  // ✅ Mapear correctamente los datos del backend
  const reportArray = this.reportData.report || [];
  
  return {
    type: 'bar',
    data: {
      labels: reportArray.map((item: any) => item.nombre_curso || 'Sin nombre'),  // ✅ Verificar que exista
      datasets: [{
        label: 'Promedio',
        data: reportArray.map((item: any) => item.promedio || 0),  // ✅ Usar promedio_curso
        backgroundColor: 'rgba(43, 139, 90, 0.7)',
        borderColor: 'rgba(43, 139, 90, 1)',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Promedio de Calificaciones por Curso',
          font: { size: 18, weight: 'bold' },
          color: '#0b6b3a'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          ticks: { stepSize: 0.5 }
        }
      }
    }
  };
}

createTeacherWorkloadChart(): ChartConfiguration {
  // ✅ Mapear correctamente los datos del backend
  const reportArray = this.reportData.report || [];
  
  return {
    type: 'bar',
    data: {
      labels: reportArray.map((item: any) => item.nombre_docente || 'Sin nombre'),
      datasets: [
        {
          label: 'Cursos',
          data: reportArray.map((item: any) => item.total_cursos || 0),
          backgroundColor: 'rgba(11, 107, 58, 0.7)',
          borderColor: 'rgba(11, 107, 58, 1)',
          borderWidth: 2,
          borderRadius: 8
        },
        {
          label: 'Estudiantes',
          data: reportArray.map((item: any) => item.total_estudiantes || 0),
          backgroundColor: 'rgba(43, 139, 90, 0.7)',
          borderColor: 'rgba(43, 139, 90, 1)',
          borderWidth: 2,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        title: {
          display: true,
          text: 'Carga Académica por Docente',
          font: { size: 18, weight: 'bold' },
          color: '#0b6b3a'
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  };
}

createEnrollmentHistoryChart(): ChartConfiguration {
  // ✅ Mapear correctamente los datos del backend
  const reportArray = this.reportData.report || [];
  
  return {
    type: 'line',
    data: {
      labels: reportArray.map((item: any) => `Periodo ${item.periodo || item._id}`),
      datasets: [{
        label: 'Matrículas',
        data: reportArray.map((item: any) => item.total_matriculas || item.total || 0),
        backgroundColor: 'rgba(11, 107, 58, 0.2)',
        borderColor: 'rgba(11, 107, 58, 1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: 'rgba(11, 107, 58, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Evolución de Matrículas por Periodo',
          font: { size: 18, weight: 'bold' },
          color: '#0b6b3a'
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  };
}

createAcademicStatisticsChart(): ChartConfiguration {
  // ✅ Acceder correctamente a las estadísticas
  const stats = this.reportData.statistics || this.reportData;
  
  return {
    type: 'doughnut',
    data: {
      labels: ['Estudiantes', 'Docentes', 'Cursos', 'Matrículas'],
      datasets: [{
        data: [
          stats.total_estudiantes || stats.estudiantes?.activos || 0,
          stats.total_docentes || stats.docentes?.activos || 0,
          stats.total_cursos || stats.cursos?.activos || 0,
          stats.total_matriculas || stats.matriculas?.activas || 0
        ],
        backgroundColor: [
          'rgba(11, 107, 58, 0.8)',
          'rgba(43, 139, 90, 0.8)',
          'rgba(76, 175, 80, 0.8)',
          'rgba(129, 199, 132, 0.8)'
        ],
        borderColor: [
          'rgba(11, 107, 58, 1)',
          'rgba(43, 139, 90, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(129, 199, 132, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right'
        },
        title: {
          display: true,
          text: 'Estadísticas Académicas Generales',
          font: { size: 18, weight: 'bold' },
          color: '#0b6b3a'
        }
      }
    }
  };
}
  downloadPDF(report: Report): void {
    alert(`Descarga de PDF para "${report.title}" en desarrollo.\n\nEn producción se generará un PDF con la gráfica.`);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/admin']);
  }

  getReportTitle(): string {
    if (!this.selectedReport) return '';
    const report = this.reports.find(r => r.id === this.selectedReport);
    return report ? report.title : '';
  }

  formatReportData(): string {
    if (!this.reportData) return 'No hay datos disponibles';
    return JSON.stringify(this.reportData, null, 2);
  }

  ngOnDestroy(): void {
    if (this.currentChart) {
      this.currentChart.destroy();
    }
  }
}