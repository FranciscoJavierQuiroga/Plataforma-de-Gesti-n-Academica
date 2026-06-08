import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../services/alert.service';
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
    private router: Router,
    private alertService: AlertService
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
    const reportArray = this.reportData.report || [];
    const colors = reportArray.map((_: any, i: number) => {
      const hues = ['#0b6b3a', '#0d8545', '#2b8b5a', '#3da66c', '#4db87d', '#5eca8e'];
      return hues[i % hues.length];
    });
    const borderColors = reportArray.map((_: any, i: number) => {
      const hues = ['#05341d', '#0b6b3a', '#0d8545', '#2b8b5a', '#3da66c', '#4db87d'];
      return hues[i % hues.length];
    });

    return {
      type: 'bar',
      data: {
        labels: reportArray.map((item: any) => `Grado ${item._id}`),
        datasets: [{
          label: 'Cantidad de Estudiantes',
          data: reportArray.map((item: any) => item.total_estudiantes),
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Distribución de Estudiantes por Grado',
            font: { size: 18, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
            color: '#0b6b3a',
            padding: { bottom: 20 }
          },
          tooltip: {
            backgroundColor: '#05341d',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 14 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context: any) => `${context.parsed.y} estudiantes`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { family: "'Plus Jakarta Sans', sans-serif" } },
            grid: { color: 'rgba(11, 107, 58, 0.08)' }
          },
          x: {
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    };
  }

createPerformanceByCourseChart(): ChartConfiguration {
    const reportArray = this.reportData.report || [];

    const getColor = (value: number) => {
      if (value >= 4.0) return '#0b6b3a';
      if (value >= 3.0) return '#c9972e';
      return '#c0392b';
    };
    const getBgColor = (value: number) => {
      if (value >= 4.0) return 'rgba(11, 107, 58, 0.75)';
      if (value >= 3.0) return 'rgba(201, 151, 46, 0.75)';
      return 'rgba(192, 57, 43, 0.75)';
    };

    const data = reportArray.map((item: any) => item.promedio || 0);

    return {
      type: 'bar',
      data: {
        labels: reportArray.map((item: any) => item.nombre_curso || 'Sin nombre'),
        datasets: [{
          label: 'Promedio',
          data: data,
          backgroundColor: data.map((v: number) => getBgColor(v)),
          borderColor: data.map((v: number) => getColor(v)),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Promedio de Calificaciones por Curso',
            font: { size: 18, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
            color: '#0b6b3a',
            padding: { bottom: 20 }
          },
          tooltip: {
            backgroundColor: '#05341d',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 14 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context: any) => `Promedio: ${context.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
            ticks: { stepSize: 0.5, font: { family: "'Plus Jakarta Sans', sans-serif" } },
            grid: { color: 'rgba(11, 107, 58, 0.08)' }
          },
          x: {
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    };
  }

createTeacherWorkloadChart(): ChartConfiguration {
    const reportArray = this.reportData.report || [];

    return {
      type: 'bar',
      data: {
        labels: reportArray.map((item: any) => item.nombre_docente || 'Sin nombre'),
        datasets: [
          {
            label: 'Cursos',
            data: reportArray.map((item: any) => item.total_cursos || 0),
            backgroundColor: 'rgba(11, 107, 58, 0.8)',
            borderColor: '#0b6b3a',
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Estudiantes',
            data: reportArray.map((item: any) => item.total_estudiantes || 0),
            backgroundColor: 'rgba(201, 151, 46, 0.8)',
            borderColor: '#c9972e',
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20
            }
          },
          title: {
            display: true,
            text: 'Carga Académica por Docente',
            font: { size: 18, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
            color: '#0b6b3a',
            padding: { bottom: 20 }
          },
          tooltip: {
            backgroundColor: '#05341d',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 14 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } },
            grid: { color: 'rgba(11, 107, 58, 0.08)' }
          },
          x: {
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    };
  }

createEnrollmentHistoryChart(): ChartConfiguration {
    const reportArray = this.reportData.report || [];

    return {
      type: 'line',
      data: {
        labels: reportArray.map((item: any) => `Periodo ${item.periodo || item._id}`),
        datasets: [{
          label: 'Matrículas',
          data: reportArray.map((item: any) => item.total_matriculas || item.total || 0),
          backgroundColor: (ctx: any) => {
            const canvas = ctx.chart.ctx;
            const gradient = canvas.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(11, 107, 58, 0.25)');
            gradient.addColorStop(1, 'rgba(11, 107, 58, 0.02)');
            return gradient;
          },
          borderColor: '#0b6b3a',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: '#0b6b3a',
          pointBorderColor: '#fff',
          pointBorderWidth: 3,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#0d8545',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Evolución de Matrículas por Periodo',
            font: { size: 18, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
            color: '#0b6b3a',
            padding: { bottom: 20 }
          },
          tooltip: {
            backgroundColor: '#05341d',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 14 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context: any) => `${context.parsed.y} matrículas`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } },
            grid: { color: 'rgba(11, 107, 58, 0.08)' }
          },
          x: {
            ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    };
  }

createAcademicStatisticsChart(): ChartConfiguration {
    const stats = this.reportData.statistics || this.reportData;
    const data = [
      stats.total_estudiantes || stats.estudiantes?.activos || 0,
      stats.total_docentes || stats.docentes?.activos || 0,
      stats.total_cursos || stats.cursos?.activos || 0,
      stats.total_matriculas || stats.matriculas?.activas || 0
    ];

    return {
      type: 'doughnut',
      data: {
        labels: ['Estudiantes', 'Docentes', 'Cursos', 'Matrículas'],
        datasets: [{
          data: data,
          backgroundColor: [
            '#0b6b3a',
            '#0d8545',
            '#2b8b5a',
            '#c9972e'
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          title: {
            display: true,
            text: 'Estadísticas Académicas Generales',
            font: { size: 18, weight: 'bold', family: "'Plus Jakarta Sans', sans-serif" },
            color: '#0b6b3a',
            padding: { bottom: 20 }
          },
          tooltip: {
            backgroundColor: '#05341d',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 14 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context: any) => {
                const total = data.reduce((a: number, b: number) => a + b, 0);
                const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${context.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    };
  }
  downloadPDF(report: Report): void {
    this.alertService.info(`Descarga de PDF para "${report.title}" en desarrollo.\n\nEn producción se generará un PDF con la gráfica.`);
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