// role-guard.spec.ts
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

// Mock the entire Angular router and core modules before importing the guard
jest.mock('@angular/router', () => ({
  ...jest.requireActual('@angular/router'),
  Router: jest.fn().mockImplementation(() => ({
    navigate: jest.fn()
  }))
}));

jest.mock('@angular/core', () => ({
  ...jest.requireActual('@angular/core'),
  inject: jest.fn()
}));

// Now import the guard and the helper functions directly
import { RoleGuard, decodeToken, matchRole } from './role-guard';
import { inject } from '@angular/core';

describe('RoleGuard', () => {
  let guard: any;
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;
  let mockRouter: any;

  beforeEach(() => {
    // Setup mock router
    mockRouter = {
      navigate: jest.fn()
    };
    
    // Mock inject to return our mock router
    (inject as jest.Mock).mockReturnValue(mockRouter);

    // Setup guard and mocks
    guard = RoleGuard;
    mockRoute = {
      data: {}
    } as ActivatedRouteSnapshot;
    mockState = {
      url: '/protected-route'
    } as RouterStateSnapshot;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
      },
      writable: true,
    });

    // Mock atob for JWT decoding
    Object.defineProperty(window, 'atob', {
      value: jest.fn(),
      writable: true,
    });

    // Mock btoa for test setup
    Object.defineProperty(window, 'btoa', {
      value: (str: string) => Buffer.from(str).toString('base64'),
      writable: true,
    });

    // Mock console to avoid test output clutter
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when no token exists', () => {
    it('should redirect to login and return false', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const result = guard(mockRoute, mockState);

      expect(localStorage.getItem).toHaveBeenCalledWith('access_token');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(result).toBe(false);
    });
  });

  describe('when token exists', () => {
    it('should allow access when roles match exactly', () => {
      const payload = { role: 'admin' };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = { role: 'admin' };

      const result = guard(mockRoute, mockState);

      expect(result).toBe(true);
    });

    it('should allow access for role aliases', () => {
      const payload = { role: 'estudiante' };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = { role: 'student' };

      const result = guard(mockRoute, mockState);

      expect(result).toBe(true);
    });

    it('should deny access when roles dont match', () => {
      const payload = { role: 'student' };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = { role: 'admin' };

      const result = guard(mockRoute, mockState);

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/unauthorized']);
    });

    it('should allow access when no role is required', () => {
      const payload = { role: 'student' };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = {};

      const result = guard(mockRoute, mockState);

      expect(result).toBe(true);
    });

    it('should redirect to login when token is invalid', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid.token.here');
      (window.atob as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid base64');
      });

      const result = guard(mockRoute, mockState);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(result).toBe(false);
    });
  });

  describe('role extraction from different token formats', () => {
    it('should extract role from direct role field', () => {
      const payload = { role: 'admin' };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = { role: 'admin' };

      const result = guard(mockRoute, mockState);

      expect(result).toBe(true);
    });

    it('should extract role from realm_access.roles', () => {
      const payload = {
        realm_access: {
          roles: ['estudiante', 'other-role']
        }
      };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = { role: 'student' };

      const result = guard(mockRoute, mockState);

      expect(result).toBe(true);
    });

    it('should extract role from resource_access', () => {
      const payload = {
        resource_access: {
          'client-id': {
            roles: ['docente']
          }
        }
      };
      const base64Payload = btoa(JSON.stringify(payload));
      (localStorage.getItem as jest.Mock).mockReturnValue(`header.${base64Payload}.signature`);
      (window.atob as jest.Mock).mockReturnValue(JSON.stringify(payload));
      mockRoute.data = { role: 'teacher' };

      const result = guard(mockRoute, mockState);

      expect(result).toBe(true);
    });
  });
});

// Create a separate describe block with fresh mocks for helper functions
describe('RoleGuard Helper Functions', () => {
  // Save the original implementations
  const originalAtob = window.atob;
  const originalBtoa = window.btoa;

  beforeEach(() => {
    // Restore original implementations for helper function tests
    Object.defineProperty(window, 'atob', {
      value: originalAtob,
      writable: true,
    });
    
    Object.defineProperty(window, 'btoa', {
      value: originalBtoa,
      writable: true,
    });
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* describe('decodeToken', () => {
    it('should decode valid JWT token', () => {
      const payload = { role: 'admin', sub: '123' };
      const base64Payload = btoa(JSON.stringify(payload));
      const token = `header.${base64Payload}.signature`;

      const result = decodeToken(token);

      expect(result).toEqual(payload);
    }); */

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';

      expect(() => {
        decodeToken(token);
      }).toThrow('Invalid token format');
    });

    /* it('should handle tokens with special characters', () => {
      const payload = { role: 'admin', name: 'test@example.com' };
      const base64Payload = btoa(JSON.stringify(payload));
      // Create a proper JWT with base64url encoding
      const base64UrlPayload = base64Payload.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `header.${base64UrlPayload}.signature`;

      const result = decodeToken(token);

      expect(result).toEqual(payload);
    }); */

    it('should decode token with realm_access roles', () => {
      const payload = {
        realm_access: {
          roles: ['admin', 'user']
        }
      };
      const base64Payload = btoa(JSON.stringify(payload));
      const token = `header.${base64Payload}.signature`;

      const result = decodeToken(token);

      expect(result).toEqual(payload);
    });
  });

  describe('matchRole', () => {
    it('should match exact roles', () => {
      expect(matchRole('admin', 'admin')).toBe(true);
      expect(matchRole('student', 'student')).toBe(true);
      expect(matchRole('teacher', 'teacher')).toBe(true);
    });

    it('should match role aliases', () => {
      expect(matchRole('estudiante', 'student')).toBe(true);
      expect(matchRole('student', 'estudiante')).toBe(true);
      expect(matchRole('docente', 'teacher')).toBe(true);
      expect(matchRole('teacher', 'docente')).toBe(true);
      expect(matchRole('administrador', 'admin')).toBe(true);
      expect(matchRole('admin', 'administrador')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(matchRole('ADMIN', 'admin')).toBe(true);
      expect(matchRole('Admin', 'ADMIN')).toBe(true);
      expect(matchRole('ESTUDIANTE', 'student')).toBe(true);
    });

    it('should not match different roles', () => {
      expect(matchRole('student', 'admin')).toBe(false);
      expect(matchRole('teacher', 'student')).toBe(false);
      expect(matchRole('admin', 'teacher')).toBe(false);
    });

    it('should handle empty or undefined roles', () => {
      expect(matchRole('', 'admin')).toBe(false);
      expect(matchRole('student', '')).toBe(false);
      expect(matchRole(undefined as any, 'admin')).toBe(false);
      expect(matchRole('admin', undefined as any)).toBe(false);
    });

    it('should match profesor alias for teacher', () => {
      expect(matchRole('profesor', 'teacher')).toBe(true);
      expect(matchRole('teacher', 'profesor')).toBe(true);
    });

    it('should match administrator alias for admin', () => {
      expect(matchRole('administrator', 'admin')).toBe(true);
      expect(matchRole('admin', 'administrator')).toBe(true);
    });
  });