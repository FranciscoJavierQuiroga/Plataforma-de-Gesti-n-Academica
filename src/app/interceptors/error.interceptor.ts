import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '../services/alert.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const alertService = inject(AlertService);
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      
      if (error.status === 401) {
        console.warn('No autorizado - redirigiendo a login');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        router.navigate(['/login']);
      }
      
      if (error.status === 403) {
        alertService.error('No tienes permisos para acceder a este recurso');
      }
      
      return throwError(() => error);
    })
  );
};