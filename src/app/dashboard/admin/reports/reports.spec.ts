import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ReportsComponent } from './reports';
import { ApiService } from '../../../services/api.service';
import { Chart } from 'chart.js';

// Mock Chart.js
jest.mock('chart.js', () => ({
  Chart: Object.assign(
    jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
      update: jest.fn(),
      config: { type: 'bar' }
    })),
    {
      register: jest.fn()
    }
  ),
  registerables: []
}));

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;
  let mockApiService: jest.Mocked<ApiService>;
  let mockRouter: jest.Mocked<Router>;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: any;

  // Mock data for different reports
  const mockStudentsByGradeData = {
    report: [
      { _id: '6', total_estudiantes: 25 },
      { _id: '7', total_estudiantes: 30 },
      { _id: '8', total_estudiantes: 28 }
    ]
  };

  const mockPerformanceByCourseData = {
    report: [
      { nombre_curso: 'Matemáticas', promedio: 4.2 },
      { nombre_curso: 'Español', promedio: 4.5 },
      { nombre_curso: 'Ciencias', promedio: 3.8 }
    ]
  };

  const mockTeacherWorkloadData = {
    report: [
      { nombre_docente: 'Juan Pérez', total_cursos: 3, total_estudiantes: 75 },
      { nombre_docente: 'María García', total_cursos: 2, total_estudiantes: 50 }
    ]
  };

  const mockEnrollmentHistoryData = {
    report: [
      { periodo: '2023-1', total_matriculas: 100 },
      { periodo: '2023-2', total_matriculas: 120 },
      { periodo: '2024-1', total_matriculas: 115 }
    ]
  };

  const mockAcademicStatisticsData = {
    statistics: {
      total_estudiantes: 150,
      total_docentes: 10,
      total_cursos: 15,
      total_matriculas: 200
    }
  };

  beforeEach(async () => {
    // Create mock services
    mockApiService = {
      getReportStudentsByGrade: jest.fn(),
      getReportPerformanceByCourse: jest.fn(),
      getReportTeacherWorkload: jest.fn(),
      getReportEnrollmentHistory: jest.fn(),
      getReportAcademicStatistics: jest.fn()
    } as any;

    mockRouter = {
      navigate: jest.fn()
    } as any;

    // Mock Canvas and Context
    mockContext = {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      getImageData: jest.fn(),
      putImageData: jest.fn(),
      createImageData: jest.fn(),
      setTransform: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      fillText: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      transform: jest.fn(),
      rect: jest.fn(),
      clip: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;

    // Setup canvas mock
    mockCanvas = document.createElement('canvas');
    mockCanvas.getContext = jest.fn().mockReturnValue(mockContext);
  });

  afterEach(() => {
    // Clean up charts
    if (component.currentChart) {
      component.currentChart.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
      expect(component.reportData).toBeNull();
      expect(component.selectedReport).toBeNull();
      expect(component.currentChart).toBeNull();
    });

    it('should have 5 predefined reports', () => {
      expect(component.reports).toHaveLength(5);
      expect(component.reports[0].id).toBe('students-by-grade');
      expect(component.reports[1].id).toBe('performance-by-course');
      expect(component.reports[2].id).toBe('teacher-workload');
      expect(component.reports[3].id).toBe('enrollment-history');
      expect(component.reports[4].id).toBe('academic-statistics');
    });
  });

  describe('generateReport', () => {
    it('should generate students-by-grade report successfully', (done) => {
      mockApiService.getReportStudentsByGrade.mockReturnValue(
        of(mockStudentsByGradeData)
      );

      const report = component.reports[0];
      
      // Mock the renderChart method to avoid canvas issues
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);

      expect(component.selectedReport).toBe('students-by-grade');
      expect(mockApiService.getReportStudentsByGrade).toHaveBeenCalled();

      setTimeout(() => {
        expect(component.loading).toBe(false);
        expect(component.reportData).toEqual(mockStudentsByGradeData);
        expect(component.error).toBeNull();
        done();
      }, 150);
    });

    it('should generate performance-by-course report successfully', (done) => {
      mockApiService.getReportPerformanceByCourse.mockReturnValue(
        of(mockPerformanceByCourseData)
      );

      const report = component.reports[1];
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);

      expect(mockApiService.getReportPerformanceByCourse).toHaveBeenCalled();

      setTimeout(() => {
        expect(component.reportData).toEqual(mockPerformanceByCourseData);
        done();
      }, 150);
    });

    it('should generate teacher-workload report successfully', (done) => {
      mockApiService.getReportTeacherWorkload.mockReturnValue(
        of(mockTeacherWorkloadData)
      );

      const report = component.reports[2];
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);

      expect(mockApiService.getReportTeacherWorkload).toHaveBeenCalled();

      setTimeout(() => {
        expect(component.reportData).toEqual(mockTeacherWorkloadData);
        done();
      }, 150);
    });

    it('should generate enrollment-history report successfully', (done) => {
      mockApiService.getReportEnrollmentHistory.mockReturnValue(
        of(mockEnrollmentHistoryData)
      );

      const report = component.reports[3];
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);

      expect(mockApiService.getReportEnrollmentHistory).toHaveBeenCalled();

      setTimeout(() => {
        expect(component.reportData).toEqual(mockEnrollmentHistoryData);
        done();
      }, 150);
    });

    it('should generate academic-statistics report successfully', (done) => {
      mockApiService.getReportAcademicStatistics.mockReturnValue(
        of(mockAcademicStatisticsData)
      );

      const report = component.reports[4];
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);

      expect(mockApiService.getReportAcademicStatistics).toHaveBeenCalled();

      setTimeout(() => {
        expect(component.reportData).toEqual(mockAcademicStatisticsData);
        done();
      }, 150);
    });

    it('should handle error when generating report', (done) => {
      const errorMessage = 'API Error';
      mockApiService.getReportStudentsByGrade.mockReturnValue(
        throwError(() => new Error(errorMessage))
      );

      const report = component.reports[0];
      
      // Suppress console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      component.generateReport(report);

      setTimeout(() => {
        expect(component.loading).toBe(false);
        expect(component.error).toBe('Error al generar el reporte');
        consoleErrorSpy.mockRestore();
        done();
      }, 50);
    });

    it('should destroy previous chart before generating new report', () => {
      const mockChart = { destroy: jest.fn() } as any;
      component.currentChart = mockChart;

      mockApiService.getReportStudentsByGrade.mockReturnValue(
        of(mockStudentsByGradeData)
      );

      const report = component.reports[0];
      component.generateReport(report);

      expect(mockChart.destroy).toHaveBeenCalled();
    });

    it('should handle unknown report endpoint', () => {
      const unknownReport = {
        id: 'unknown',
        title: 'Unknown',
        description: 'Test',
        icon: 'test',
        endpoint: 'unknown-endpoint'
      };

      component.generateReport(unknownReport);

      expect(component.loading).toBe(false);
      expect(component.error).toBe('Reporte no disponible');
    });
  });

  describe('renderChart', () => {
    beforeEach(() => {
      // Set up mock canvas for component
      component.chartCanvas = {
        nativeElement: mockCanvas
      } as any;
    });

    it('should not render chart if canvas is not available', () => {
      component.chartCanvas = undefined;
      component.reportData = mockStudentsByGradeData;

      const report = component.reports[0];
      component.renderChart(report);

      expect(component.currentChart).toBeNull();
    });

    it('should not render chart if reportData is null', () => {
      component.reportData = null;

      const report = component.reports[0];
      component.renderChart(report);

      expect(component.currentChart).toBeNull();
    });

    it('should create chart for students-by-grade', () => {
      component.reportData = mockStudentsByGradeData;
      const report = component.reports[0];

      component.renderChart(report);

      expect(Chart).toHaveBeenCalled();
      expect(component.currentChart).toBeTruthy();
    });

    it('should create chart for performance-by-course', () => {
      component.reportData = mockPerformanceByCourseData;
      const report = component.reports[1];

      component.renderChart(report);

      expect(Chart).toHaveBeenCalled();
      expect(component.currentChart).toBeTruthy();
    });

    it('should create chart for teacher-workload', () => {
      component.reportData = mockTeacherWorkloadData;
      const report = component.reports[2];

      component.renderChart(report);

      expect(Chart).toHaveBeenCalled();
      expect(component.currentChart).toBeTruthy();
    });

    it('should create chart for enrollment-history', () => {
      component.reportData = mockEnrollmentHistoryData;
      const report = component.reports[3];

      component.renderChart(report);

      expect(Chart).toHaveBeenCalled();
      expect(component.currentChart).toBeTruthy();
    });

    it('should create chart for academic-statistics', () => {
      component.reportData = mockAcademicStatisticsData;
      const report = component.reports[4];

      component.renderChart(report);

      expect(Chart).toHaveBeenCalled();
      expect(component.currentChart).toBeTruthy();
    });

    it('should destroy previous chart before creating new one', () => {
      const mockChart = { destroy: jest.fn() } as any;
      component.currentChart = mockChart;
      component.reportData = mockStudentsByGradeData;

      const report = component.reports[0];
      component.renderChart(report);

      expect(mockChart.destroy).toHaveBeenCalled();
    });

    it('should handle null context gracefully', () => {
      const nullContextCanvas = document.createElement('canvas');
      nullContextCanvas.getContext = jest.fn().mockReturnValue(null);
      
      component.chartCanvas = {
        nativeElement: nullContextCanvas
      } as any;
      component.reportData = mockStudentsByGradeData;

      const report = component.reports[0];
      
      expect(() => component.renderChart(report)).not.toThrow();
      expect(component.currentChart).toBeNull();
    });
  });

  describe('Chart Configuration Methods', () => {
    it('should create students-by-grade chart config', () => {
      component.reportData = mockStudentsByGradeData;
      const config = component.createStudentsByGradeChart();

      expect(config.type).toBe('bar');
      expect(config.data?.labels).toHaveLength(3);
      expect(config.data?.datasets[0].data).toHaveLength(3);
      expect(config.data?.labels?.[0]).toBe('Grado 6');
    });

    it('should create performance-by-course chart config', () => {
      component.reportData = mockPerformanceByCourseData;
      const config = component.createPerformanceByCourseChart();

      expect(config.type).toBe('bar');
      expect(config.data?.labels).toContain('Matemáticas');
      expect(config.options?.scales?.['y']?.max).toBe(5);
    });

    it('should create teacher-workload chart config with multiple datasets', () => {
      component.reportData = mockTeacherWorkloadData;
      const config = component.createTeacherWorkloadChart();

      expect(config.type).toBe('bar');
      expect(config.data?.datasets).toHaveLength(2);
      expect(config.data?.datasets[0].label).toBe('Cursos');
      expect(config.data?.datasets[1].label).toBe('Estudiantes');
    });

    it('should create enrollment-history chart config', () => {
      component.reportData = mockEnrollmentHistoryData;
      const config = component.createEnrollmentHistoryChart();

      expect(config.type).toBe('line');
      expect((config.data?.datasets[0] as any).tension).toBe(0.4);
      expect(config.data?.labels).toHaveLength(3);
    });

    it('should create academic-statistics chart config', () => {
      component.reportData = mockAcademicStatisticsData;
      const config = component.createAcademicStatisticsChart();

      expect(config.type).toBe('doughnut');
      expect(config.data?.labels).toHaveLength(4);
      expect(config.data?.datasets[0].data).toHaveLength(4);
      expect(config.data?.labels).toEqual(['Estudiantes', 'Docentes', 'Cursos', 'Matrículas']);
    });

    it('should handle missing data in performance chart', () => {
      component.reportData = { report: [{ nombre_curso: null, promedio: null }] };
      const config = component.createPerformanceByCourseChart();

      expect(config.data?.labels?.[0]).toBe('Sin nombre');
      expect(config.data?.datasets[0].data[0]).toBe(0);
    });

    it('should handle alternative data structure in academic statistics', () => {
      component.reportData = {
        estudiantes: { activos: 100 },
        docentes: { activos: 20 },
        cursos: { activos: 30 },
        matriculas: { activas: 150 }
      };
      const config = component.createAcademicStatisticsChart();

      expect(config.data?.datasets[0].data[0]).toBe(100);
      expect(config.data?.datasets[0].data[1]).toBe(20);
      expect(config.data?.datasets[0].data[2]).toBe(30);
      expect(config.data?.datasets[0].data[3]).toBe(150);
    });

    it('should handle empty report arrays', () => {
      component.reportData = { report: [] };
      const config = component.createStudentsByGradeChart();

      expect(config.data?.labels).toHaveLength(0);
      expect(config.data?.datasets[0].data).toHaveLength(0);
    });
  });

  describe('Utility Methods', () => {
    it('should navigate back to admin dashboard', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
    });

    it('should return report title when report is selected', () => {
      component.selectedReport = 'students-by-grade';
      const title = component.getReportTitle();
      expect(title).toBe('Estudiantes por Grado');
    });

    it('should return empty string when no report is selected', () => {
      component.selectedReport = null;
      const title = component.getReportTitle();
      expect(title).toBe('');
    });

    it('should return empty string for invalid report id', () => {
      component.selectedReport = 'invalid-id';
      const title = component.getReportTitle();
      expect(title).toBe('');
    });

    it('should format report data as JSON string', () => {
      component.reportData = mockStudentsByGradeData;
      const formatted = component.formatReportData();
      expect(formatted).toContain('"report"');
      expect(formatted).toContain('"_id"');
    });

    it('should return message when no report data available', () => {
      component.reportData = null;
      const formatted = component.formatReportData();
      expect(formatted).toBe('No hay datos disponibles');
    });

    it('should show alert when downloading PDF', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      const report = component.reports[0];
      
      component.downloadPDF(report);
      
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Estudiantes por Grado')
      );
      alertSpy.mockRestore();
    });
  });

  describe('Component Lifecycle', () => {
    it('should destroy chart on component destroy', () => {
      const mockChart = { destroy: jest.fn() } as any;
      component.currentChart = mockChart;

      component.ngOnDestroy();

      expect(mockChart.destroy).toHaveBeenCalled();
    });

    it('should not throw error when destroying without chart', () => {
      component.currentChart = null;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle report generation with already loading state', () => {
      component.loading = true;
      mockApiService.getReportStudentsByGrade.mockReturnValue(
        of(mockStudentsByGradeData)
      );

      const report = component.reports[0];
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);
      
      expect(component.selectedReport).toBe('students-by-grade');
    });

    it('should clear error when generating new report', () => {
      component.error = 'Previous error';
      mockApiService.getReportStudentsByGrade.mockReturnValue(
        of(mockStudentsByGradeData)
      );

      const report = component.reports[0];
      jest.spyOn(component, 'renderChart').mockImplementation();
      
      component.generateReport(report);
      
      expect(component.error).toBeNull();
    });

    it('should handle enrollment history with alternative data structure', () => {
      component.reportData = {
        report: [
          { _id: '2023-1', total: 100 },
          { _id: '2023-2', total: 120 }
        ]
      };
      const config = component.createEnrollmentHistoryChart();

      expect(config.data?.labels?.[0]).toBe('Periodo 2023-1');
      expect(config.data?.datasets[0].data[0]).toBe(100);
    });
  });
});