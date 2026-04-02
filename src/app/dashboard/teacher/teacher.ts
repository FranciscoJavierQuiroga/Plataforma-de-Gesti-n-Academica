import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AlertService } from '../../services/alert.service';
import { AuthService } from '../../services/auth.service';

interface Group {
  _id: string;
  name: string;
  students: number;
  progress_pct: number;
  codigo?: string;
  periodo?: string;
}

interface Overview {
  groups_count: number;
  pending_grades: number;
  total_students: number;
  next_event: string;
  teacher_name: string;
  especialidad: string;
}

@Component({
  selector: 'app-dashboard-teacher',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './teacher.html',
  styleUrls: ['./teacher.css']
})
export default class TeacherComponent implements OnInit {
  groups: Group[] = [];
  overview: Overview | null = null;
  loading = false;
  error: string | null = null;

  constructor(
    private api: ApiService,
    private router: Router,
    private alertService: AlertService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    console.log('🎓 Inicializando panel de docente...');
    this.loadAll();
  }

  async loadAll() {
    this.loading = true;
    this.error = null;

    try {
      await Promise.all([
        this.loadGroups(),
        this.loadOverview()
      ]);
      console.log('✅ Datos del docente cargados');
    } catch (err) {
      console.error('❌ Error cargando datos del docente:', err);
      this.error = 'Error al cargar la información del docente';
    } finally {
      this.loading = false;
    }
  }

  loadGroups(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📚 Cargando grupos...');
      
      this.api.getTeacherGroups().subscribe({
        next: (res: any) => {
          console.log('✅ Respuesta de grupos:', res);
          
          if (res.success && res.groups) {
            this.groups = res.groups.map((g: any) => ({
              _id: g._id,
              name: g.name,
              students: g.students || 0,
              progress_pct: g.progress_pct || 0,
              codigo: g.codigo,
              periodo: g.periodo
            }));
            console.log(`📚 ${this.groups.length} grupos cargados`);
          } else {
            console.warn('⚠️ Respuesta sin grupos:', res);
            this.groups = [];
          }
          resolve();
        },
        error: (err) => {
          console.error('❌ Error cargando grupos:', err);
          this.groups = [];
          reject(err);
        }
      });
    });
  }

  loadOverview(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📊 Cargando overview...');
      
      this.api.getTeacherOverview().subscribe({
        next: (res: any) => {
          console.log('✅ Respuesta de overview:', res);
          
          if (res.success) {
            this.overview = {
              groups_count: res.groups_count || 0,
              pending_grades: res.pending_grades || 0,
              total_students: res.total_students || 0,
              next_event: res.next_event || 'Sin eventos programados',
              teacher_name: res.teacher_name || 'Docente',
              especialidad: res.especialidad || 'N/A'
            };
            console.log('📊 Overview cargado:', this.overview);
          } else {
            console.warn('⚠️ Respuesta sin success:', res);
            this.overview = null;
          }
          resolve();
        },
        error: (err) => {
          console.error('❌ Error cargando overview:', err);
          this.overview = null;
          reject(err);
        }
      });
    });
  }

  getTeacherName(): string {
    return this.overview?.teacher_name || 'Docente';
  }

  async logout(): Promise<void> {
    try {
      console.log('🔓 Cerrando sesión...');
      this.authService.logout();
      this.alertService.success('Sesión cerrada exitosamente');
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      this.alertService.error('Error al cerrar sesión');
    }
  }
}