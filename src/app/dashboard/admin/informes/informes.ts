import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../services/alert.service';
import { HttpResponse } from '@angular/common/http';

interface TipoInforme {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
}

@Component({
  selector: 'app-informes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './informes.html',
  styleUrls: ['./informes.css']
})
export class Informes {
  loading = false;
  
  tiposInformes: TipoInforme[] = [
    { 
      id: 'estudiantes', 
      nombre: 'Reporte de Estudiantes', 
      descripcion: 'Lista completa de estudiantes matriculados',
      icono: '👥'
    },
    { 
      id: 'calificaciones', 
      nombre: 'Reporte de Calificaciones', 
      descripcion: 'Consolidado de notas por periodo',
      icono: '📊'
    },
    { 
      id: 'asistencia', 
      nombre: 'Reporte de Asistencia', 
      descripcion: 'Registro de asistencia por grupo',
      icono: '📅'
    },
    { 
      id: 'docentes', 
      nombre: 'Reporte de Docentes', 
      descripcion: 'Lista de profesores y asignaturas',
      icono: '👨‍🏫'
    },
    { 
      id: 'financiero', 
      nombre: 'Reporte Financiero', 
      descripcion: 'Estado de pagos y cartera',
      icono: '💰'
    }
  ];

  constructor(
    private router: Router,
    private api: ApiService,
    private alertService: AlertService
  ) {}

  generarInforme(tipo: TipoInforme) {
    this.loading = true;
    
    // Aquí agregarías la llamada real al backend cuando esté implementado
    // Por ahora simulamos la generación
    
    // Mock: simular descarga de PDF
    setTimeout(() => {
      this.loading = false;
      this.alertService.success(`Informe "${tipo.nombre}" generado exitosamente.\n\nEn producción, este PDF se descargaría automáticamente.`);
    }, 1500);
  }

  goBack() {
    this.router.navigate(['/dashboard/admin']);
  }
}