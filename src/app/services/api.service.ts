import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private adminUrl = environment.api.admin;

  constructor(private http: HttpClient) { }

  // ===== AUTENTICACIÓN =====
  login(credentials: { username: string; password: string }) {
    return this.http.post(`${environment.api.login}/login`, credentials);
  }

  getDashboard() {
    return this.http.get(`${environment.api.admin}/dashboard-general`);
  }

  // ===== ESTUDIANTES =====
  getStudentsList() {
    return this.http.get(`${environment.api.students}/students`);
  }

  getStudent(id: string) {
    return this.http.get(`${environment.api.students}/students/${id}`);
  }

  getStudentGrades() {
    return this.http.get(`${environment.api.students}/student/grades`);
  }

  getStudentNotifications() {
    return this.http.get(`${environment.api.students}/student/notifications`);
  }

  getStudentSchedule() {
    return this.http.get(`${environment.api.students}/student/schedule`);
  }

  // ===== PROFESORES =====
  getTeachersList() {
    return this.http.get(`${environment.api.teachers}/teachers`);
  }

  getTeacher(id: string) {
    return this.http.get(`${environment.api.teachers}/teachers/${id}`);
  }

  createTeacher(data: any) {
    return this.http.post(`${environment.api.teachers}/teachers`, data);
  }

  updateTeacher(id: string, data: any) {
    return this.http.put(`${environment.api.teachers}/teachers/${id}`, data);
  }

  deleteTeacher(id: string) {
    return this.http.delete(`${environment.api.teachers}/teachers/${id}`);
  }

  getTeacherGroups(): Observable<any> {
    console.log('📡 API: Obteniendo grupos del docente');
    return this.http.get(`${environment.api.teachers}/teacher/groups`);
  }

  getTeacherPendingGrades() {
    return this.http.get(`${environment.api.teachers}/teacher/pending-grades`);
  }

  getTeacherOverview() {
    return this.http.get(`${environment.api.teachers}/teacher/overview`);
  }
  getTeacherObservations(filters?: any): Observable<any> {
    console.log('📡 API: Obteniendo observaciones del docente');

    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params = params.set(key, filters[key]);
        }
      });
    }

    return this.http.get(`${environment.api.teachers}/teacher/observations`, { params });
  }

  // ===== CALIFICACIONES (PROFESOR) =====
  getCourseGrades(courseId: string): Observable<any> {
    console.log('📡 API: Obteniendo calificaciones del curso/grupo:', courseId);

    // ✅ CAMBIO: Usar endpoint de grupos en lugar de cursos
    return this.http.get(`${environment.api.teachers}/teacher/groups/${courseId}/grades`);
  }
  saveGrades(data: any): Observable<any> {
    console.log('📡 API: Guardando calificaciones:', data);
    return this.http.post(`${environment.api.teachers}/teacher/grades`, data);
  }

  addGrade(data: {
    enrollment_id: string;
    tipo: string;
    nota: number;
    peso: number;
    nota_maxima?: number;
    comentarios?: string;
  }) {
    return this.http.post(`${environment.api.teachers}/teacher/grades`, data);
  }

  updateGrade(enrollmentId: string, gradeIndex: number, data: any) {
    return this.http.put(`${environment.api.teachers}/teacher/grades/${enrollmentId}`, {
      ...data,
      grade_index: gradeIndex
    });
  }

  deleteGrade(enrollmentId: string, gradeIndex: number) {
    return this.http.delete(`${environment.api.teachers}/teacher/grades/${enrollmentId}/${gradeIndex}`);
  }

  bulkUploadGrades(data: {
    course_id: string;
    periodo: string;
    tipo: string;
    peso: number;
    grades: Array<{ enrollment_id: string; nota: number; comentarios?: string; grade_index?: number }>;
  }) {
    return this.http.post(`${environment.api.teachers}/teacher/grades/bulk`, data);
  }

  // ===== ASISTENCIA =====
  getAttendance(courseId: string, fecha: string): Observable<any> {
    return this.http.get(`${environment.api.teachers}/teacher/attendance`, {
      params: { course_id: courseId, fecha: fecha }
    });
  }

  saveAttendance(data: any): Observable<any> {
    return this.http.post(`${environment.api.teachers}/teacher/attendance`, data);
  }

  getAttendanceStatistics(courseId: string, periodo?: string): Observable<any> {
    const params: any = { course_id: courseId };
    if (periodo) {
      params.periodo = periodo;
    }
    return this.http.get(`${environment.api.teachers}/teacher/attendance/statistics`, { params });
  }

  // ===== GRUPOS =====
  getGroups(): Observable<any> {
    return this.http.get(`${environment.api.groups}/groups`);
  }

  getGroupById(groupId: string): Observable<any> {
    return this.http.get(`${environment.api.groups}/groups/${groupId}`);
  }

  getGroupStudents(groupId: string): Observable<any> {
    return this.http.get(`${environment.api.groups}/groups/${groupId}/students`);
  }

  assignStudentToGroup(groupId: string, studentId: string): Observable<any> {
    return this.http.post(`${environment.api.groups}/groups/${groupId}/assign-student`, {
      student_id: studentId
    });
  }

  createGroupSchedule(groupId: string, horario: any[]): Observable<any> {
    return this.http.post(`${environment.api.groups}/groups/${groupId}/schedule`, {
      horario
    });
  }

  // ===== ADMINISTRADORES =====
  getAdministrators() {
    return this.http.get(`${environment.api.administrator}/administrators`);
  }

  getAdministrator(id: string) {
    return this.http.get(`${environment.api.administrator}/administrators/${id}`);
  }

  createAdministrator(data: any) {
    return this.http.post(`${environment.api.administrator}/administrators`, data);
  }

  updateAdministrator(id: string, data: any) {
    return this.http.put(`${environment.api.administrator}/administrators/${id}`, data);
  }

  deleteAdministrator(id: string) {
    return this.http.delete(`${environment.api.administrator}/administrators/${id}`);
  }

  getAdminOverview() {
    return this.http.get(`${environment.api.admin}/dashboard-general`);
  }

  getPendingTasks() {
    return this.http.get(`${environment.api.admin}/admin/pending-tasks`);
  }

  getCampuses() {
    return this.http.get(`${environment.api.admin}/admin/campuses`);
  }

  getRecentStats() {
    return this.http.get(`${environment.api.admin}/admin/recent-stats`);
  }

  // ===== REPORTES PDF =====
  downloadCertificado(tipo: string): Observable<HttpResponse<Blob>> {
    const url = `${environment.api.students}/student/certificado/${tipo}`;
    return this.http.get(url, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  downloadBoletin(periodo: string): Observable<HttpResponse<Blob>> {
    const url = `${environment.api.students}/student/boletin?periodo=${periodo}`;
    return this.http.get(url, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  // ===== OBSERVACIONES =====
  getObservations(filters?: { course_id?: string; tipo?: string; categoria?: string; student_id?: string }): Observable<any> {
    const params: any = {};
    if (filters) {
      if (filters.course_id) params.course_id = filters.course_id;
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.categoria) params.categoria = filters.categoria;
      if (filters.student_id) params.student_id = filters.student_id;
    }
    return this.http.get(`${environment.api.teachers}/teacher/observations`, { params });
  }

  createObservation(data: any): Observable<any> {
    return this.http.post(`${environment.api.teachers}/teacher/observations`, data);
  }

  updateObservation(observationId: string, data: any): Observable<any> {
    return this.http.put(`${environment.api.teachers}/teacher/observations/${observationId}`, data);
  }

  deleteObservation(observationId: string): Observable<any> {
    return this.http.delete(`${environment.api.teachers}/teacher/observations/${observationId}`);
  }

  getStudentObservations(studentId: string): Observable<any> {
    return this.http.get(`${environment.api.teachers}/teacher/observations/student/${studentId}`);
  }

  // ===== ESTUDIANTE - DASHBOARD =====
  getStudentProfile(): Observable<any> {
    return this.http.get(`${environment.api.students}/student/profile`);
  }

  getStudentCourses(): Observable<any> {
    return this.http.get(`${environment.api.students}/student/courses`);
  }

  // ==========================================
  //   ENDPOINTS DE ADMINISTRADOR
  // ==========================================

  // Dashboard y estadísticas
  getAdminStats() {
    return this.http.get(`${environment.api.admin}/admin/stats`);
  }

  getAdminStatistics() {
    return this.http.get(`${environment.api.admin}/admin/stats`);
  }

  getAdminDashboard() {
    return this.http.get(`${environment.api.admin}/admin/dashboard`);
  }

  // Gestión de estudiantes
  // Gestión de estudiantes
  getAdminStudents(filters?: any): Observable<any> {
    console.log('📡 API: Obteniendo estudiantes');

    let params = new HttpParams();

    if (filters) {
      if (filters.estado) {
        params = params.set('estado', filters.estado);
      }
      if (filters.grado) {
        params = params.set('grado', filters.grado);
      }
    }

    return this.http.get(`${environment.api.admin}/admin/students`, { params });
  }

  // Gestión de cursos
  getAdminCourses(filters?: any): Observable<any> {
    console.log('📡 API: Obteniendo cursos');

    let params = new HttpParams();

    if (filters) {
      if (filters.estado) {
        params = params.set('activo', filters.estado === 'activo' ? 'true' : 'false');
      }
      if (filters.grado) {
        params = params.set('grado', filters.grado);
      }
      if (filters.periodo) {
        params = params.set('periodo', filters.periodo);
      }
    }

    return this.http.get(`${environment.api.admin}/admin/courses`, { params });
  }




  getStudentDetail(studentId: string) {
    return this.http.get(`${environment.api.admin}/admin/students/${studentId}`);
  }

  createStudent(studentData: any) {
    return this.http.post(`${environment.api.admin}/admin/students`, studentData);
  }

  updateStudent(studentId: string, studentData: any) {
    return this.http.put(`${environment.api.admin}/admin/students/${studentId}`, studentData);
  }

  deleteStudent(studentId: string) {
    return this.http.delete(`${environment.api.admin}/admin/students/${studentId}`);
  }

  getCourseDetail(courseId: string) {
    return this.http.get(`${environment.api.admin}/admin/courses/${courseId}`);
  }

  createCourse(courseData: any) {
    return this.http.post(`${environment.api.admin}/admin/courses`, courseData);
  }

  updateCourse(courseId: string, courseData: any) {
    return this.http.put(`${environment.api.admin}/admin/courses/${courseId}`, courseData);
  }

  deleteCourse(courseId: string): Observable<any> {
    return this.http.delete(`${environment.api.admin}/admin/courses/${courseId}`);
  }

  assignTeacherToCourse(courseId: string, teacherId: string) {
    return this.http.put(`${environment.api.admin}/admin/courses/${courseId}/assign-teacher`, {
      teacher_id: teacherId
    });
  }

  // Obtener lista de docentes (para asignaciones)
  getAdminTeachers(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params = params.set(key, filters[key]);
        }
      });
    }
    return this.http.get(`${environment.api.admin}/admin/teachers`, { params });
  }

  // Gestión de matrículas
  getAdminEnrollments(filters: any = {}): Observable<any> {
    console.log('📡 API: Obteniendo matrículas con filtros:', filters);

    let params = new HttpParams();

    if (filters.estado) {
      params = params.set('estado', filters.estado);
    }

    if (filters.grado) {
      params = params.set('grado', filters.grado);
    }

    if (filters.periodo) {
      params = params.set('periodo', filters.periodo);
    }

    return this.http.get(`${environment.api.admin}/admin/enrollments`, { params });
  }

  createEnrollment(enrollmentData: any) {
    return this.http.post(`${environment.api.admin}/admin/enrollments`, enrollmentData);
  }

  updateEnrollmentStatus(enrollmentId: string, estado: string, observaciones?: string) {
    return this.http.put(`${environment.api.admin}/admin/enrollments/${enrollmentId}/status`, {
      estado,
      observaciones_admin: observaciones
    });
  }

  getEnrollmentDetail(enrollmentId: string): Observable<any> {
    return this.http.get(`${environment.api.admin}/admin/enrollments/${enrollmentId}`);
  }

  updateEnrollment(enrollmentId: string, data: any): Observable<any> {
    return this.http.put(`${environment.api.admin}/admin/enrollments/${enrollmentId}/status`, data);
  }
  getReportEnrollmentHistory(): Observable<any> {
    console.log('📡 API: Obteniendo reporte historial matrículas');
    return this.http.get(`${environment.api.admin}/admin/reports/enrollment-history`);
  }

  deleteEnrollment(enrollmentId: string): Observable<any> {
    return this.http.delete(`${environment.api.admin}/admin/enrollments/${enrollmentId}`);
  }

  // Reportes
  getReportStudentsByGrade(): Observable<any> {
    console.log('📡 API: Obteniendo reporte estudiantes por grado');
    // ✅ CORRECTO
    return this.http.get(`${environment.api.admin}/admin/reports/students-by-grade`);
  }

  getReportPerformanceByCourse(): Observable<any> {
    console.log('📡 API: Obteniendo reporte rendimiento por curso');
    return this.http.get(`${environment.api.admin}/admin/reports/performance-by-course`);
  }

  getReportTeacherWorkload(): Observable<any> {
    console.log('📡 API: Obteniendo reporte carga docente');
    return this.http.get(`${environment.api.admin}/admin/reports/teacher-workload`);
  }

  getReportAcademicStatistics(): Observable<any> {
    console.log('📡 API: Obteniendo estadísticas académicas');
    return this.http.get(`${environment.api.admin}/admin/reports/academic-statistics`);
  }

  // ==========================================
  //   GRUPOS Y ASIGNACIONES
  // ==========================================

  /**
   * Obtener lista de asignaturas (cursos base)
   */
  getCourses(filters?: any): Observable<any> {
    const params = this.buildQueryParams(filters);
    return this.http.get(`${environment.api.admin}/admin/courses`, { params });
  }

  /**
   * Obtener asignaciones docentes
   */
  getAssignments(filters?: { group_id?: string; teacher_id?: string; periodo?: string }): Observable<any> {
    const params = this.buildQueryParams(filters);
    return this.http.get(`${environment.api.admin}/admin/assignments`, { params });
  }

  /**
   * Obtener asignaciones de un grupo específico
   */
  getGroupAssignments(groupId: string, periodo: string = '1'): Observable<any> {
    return this.http.get(`${environment.api.admin}/admin/groups/${groupId}/assignments`, {
      params: { periodo }
    });
  }

  /**
   * Crear asignación docente (grupo + curso + docente)
   */
  createAssignment(data: {
    group_id: string;
    course_id: string;
    teacher_id: string;
    periodo: string;
    salon?: string;
    anio_lectivo?: string;
  }): Observable<any> {
    return this.http.post(`${environment.api.admin}/admin/courses`, data);
  }

  /**
   * Eliminar asignación docente
   */
  deleteAssignment(assignmentId: string): Observable<any> {
    return this.http.delete(`${environment.api.admin}/admin/assignments/${assignmentId}`);
  }

  /**
   * Obtener horario de un grupo
   */
  getGroupSchedule(groupId: string): Observable<any> {
    return this.http.get(`${environment.api.groups}/groups/${groupId}/schedule`);
  }
  // ==========================================
  //   MÉTODOS AUXILIARES
  // ==========================================

  /**
   * Construir HttpParams desde un objeto de filtros
   */
  private buildQueryParams(filters?: any): HttpParams {
    let params = new HttpParams();

    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key].toString());
        }
      });
    }

    return params;
  }

}