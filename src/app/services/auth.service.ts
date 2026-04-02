import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private TOKEN_KEY = 'access_token';
  private ROLE_KEY = 'user_role';

  // ==========================================
  //   GESTIÓN DE TOKEN
  // ==========================================

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // ==========================================
  //   GESTIÓN DE ROL
  // ==========================================

  setUserRole(role: string | null): void {
    if (role) {
      localStorage.setItem(this.ROLE_KEY, role);
    } else {
      localStorage.removeItem(this.ROLE_KEY);
    }
  }

  getUserRole(): string | null {
    return localStorage.getItem(this.ROLE_KEY);
  }

  // ==========================================
  //   AUTENTICACIÓN
  // ==========================================

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // ==========================================
  //   LOGOUT
  // ==========================================

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    console.log('🔓 Sesión cerrada - Tokens eliminados');
  }

  clear(): void {
    this.logout();
  }
}