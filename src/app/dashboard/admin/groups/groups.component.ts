import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../services/alert.service';
import { RouterModule } from '@angular/router'

@Component({
  selector: 'app-admin-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.css']
})
export class AdminGroupsComponent implements OnInit {
  grupos: any[] = [];
  estudiantes: any[] = [];  // ✅ Inicializar como array vacío
  selectedGroup: any = null;
  estudiantesGrupo: any[] = [];  // ✅ Inicializar como array vacío
  loading = false;

  constructor(
    private api: ApiService,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.loadGroups();
    this.loadStudents();
  }

  loadGroups() {
    this.loading = true;
    this.api.getGroups().subscribe({
      next: (res: any) => {
        console.log('✅ Grupos recibidos:', res);
        if (res.success) {
          this.grupos = res.data || [];  // ✅ Garantizar array
          this.alertService.success('Grupos cargados correctamente');
        } else {
          this.grupos = [];
          this.alertService.warning('No se encontraron grupos');
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('❌ Error cargando grupos:', err);
        this.alertService.error('Error al cargar grupos');
        this.grupos = [];  // ✅ Asegurar array vacío en error
        this.loading = false;
      }
    });
  }

  loadStudents() {
    this.api.getAdminStudents().subscribe({
      next: (res: any) => {
        console.log('✅ Estudiantes recibidos:', res);
        if (res.success) {
          this.estudiantes = res.students || [];  // ✅ Usar 'students' no 'data'
        } else {
          this.estudiantes = [];
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando estudiantes:', err);
        this.estudiantes = [];  // ✅ Asegurar array vacío en error
      }
    });
  }

  selectGroup(grupo: any) {
    this.selectedGroup = grupo;
    this.loadGroupStudents(grupo._id);
  }

  loadGroupStudents(groupId: string) {
    this.api.getGroupStudents(groupId).subscribe({
      next: (res: any) => {
        console.log('✅ Estudiantes del grupo:', res);
        if (res.success) {
          this.estudiantesGrupo = res.estudiantes || [];  // ✅ Garantizar array
        } else {
          this.estudiantesGrupo = [];
        }
      },
      error: (err: any) => {
        console.error('❌ Error cargando estudiantes del grupo:', err);
        this.alertService.error('Error al cargar estudiantes del grupo');
        this.estudiantesGrupo = [];  // ✅ Asegurar array vacío en error
      }
    });
  }

  async assignStudent(studentId: string) {
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
          console.log('✅ Estudiante asignado:', res);
          if (res.success) {
            this.alertService.success(
              `Estudiante asignado y matriculado en ${res.matriculas_creadas} cursos`
            );
            // Recargar listas
            this.loadGroupStudents(this.selectedGroup._id);
            this.loadStudents();
          }
        },
        error: (err: any) => {
          console.error('❌ Error asignando estudiante:', err);
          this.alertService.error('Error al asignar estudiante');
        }
      });
    }
  }
}