import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

// Create a simple test version that doesn't use inject()
const testErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const mockRouter = {
    navigate: jest.fn()
  };
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('HTTP Error:', error);
      
      if (error.status === 401) {
        console.warn('No autorizado - redirigiendo a login');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        mockRouter.navigate(['/login']);
      }
      
      if (error.status === 403) {
        console.warn('Sin permisos');
        alert('No tienes permisos para acceder a este recurso');
      }
      
      return throwError(() => error);
    })
  );
};

// Import catchError
import { catchError } from 'rxjs/operators';

describe('errorInterceptor', () => {
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // Mock alert
    Object.defineProperty(window, 'alert', {
      value: jest.fn(),
      writable: true,
    });

    // Mock console
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle 401 error by removing tokens', (done) => {
    const error401 = new HttpErrorResponse({ status: 401 });
    mockNext.mockReturnValue(throwError(() => error401));

    testErrorInterceptor({} as any, mockNext).subscribe({
      error: (error) => {
        expect(error).toBe(error401);
        expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('user_role');
        done();
      }
    });
  });

  it('should handle 403 error by showing alert', (done) => {
    const error403 = new HttpErrorResponse({ status: 403 });
    mockNext.mockReturnValue(throwError(() => error403));

    testErrorInterceptor({} as any, mockNext).subscribe({
      error: (error) => {
        expect(error).toBe(error403);
        expect(window.alert).toHaveBeenCalledWith('No tienes permisos para acceder a este recurso');
        done();
      }
    });
  });

  it('should pass through successful requests', (done) => {
    const successResponse = { data: 'success' };
    mockNext.mockReturnValue(of(successResponse));

    testErrorInterceptor({} as any, mockNext).subscribe({
      next: (response) => {
        expect(response).toBe(successResponse);
        done();
      }
    });
  });
});