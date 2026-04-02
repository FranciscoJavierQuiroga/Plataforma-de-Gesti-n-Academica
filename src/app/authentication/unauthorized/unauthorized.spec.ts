import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import UnauthorizedComponent from './unauthorized';

describe('UnauthorizedComponent', () => {
  let component: UnauthorizedComponent;
  let fixture: ComponentFixture<UnauthorizedComponent>;
  let mockRouter: any;

  beforeEach(async () => {
    mockRouter = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UnauthorizedComponent,
        CommonModule
      ],
      providers: [
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UnauthorizedComponent);
    component = fixture.componentInstance;
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
    Storage.prototype.clear = jest.fn();
    
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('goBack', () => {
    it('should navigate to student dashboard if role is estudiante', () => {
      const mockToken = createMockToken('estudiante');
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/student']);
    });

    it('should navigate to teacher dashboard if role is docente', () => {
      const mockToken = createMockToken('docente');
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/teacher']);
    });

    it('should navigate to admin dashboard if role is administrador', () => {
      const mockToken = createMockToken('administrador');
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard/admin']);
    });

    it('should navigate to login if role is unknown', () => {
      const mockToken = createMockToken('unknown_role');
      (localStorage.getItem as jest.Mock).mockReturnValue(mockToken);

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should navigate to login if no token exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should navigate to login if token is invalid', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid-token');

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should navigate to login if token parsing throws error', () => {
      const invalidToken = 'header.invalid-base64.signature';
      (localStorage.getItem as jest.Mock).mockReturnValue(invalidToken);

      component.goBack();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('logout', () => {
    it('should remove access_token from localStorage', () => {
      component.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    });

    it('should navigate to login page', () => {
      component.logout();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should call both removeItem and navigate in correct order', () => {
      component.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('template interactions', () => {
    it('should call goBack when "Volver al Dashboard" button is clicked', () => {
      jest.spyOn(component, 'goBack');
      
      const button = fixture.nativeElement.querySelector('.btn-primary');
      button.click();

      expect(component.goBack).toHaveBeenCalled();
    });

    it('should call logout when "Cerrar Sesión" button is clicked', () => {
      jest.spyOn(component, 'logout');
      
      const button = fixture.nativeElement.querySelector('.btn-secondary');
      button.click();

      expect(component.logout).toHaveBeenCalled();
    });

    it('should display correct unauthorized message', () => {
      const compiled = fixture.nativeElement;
      const heading = compiled.querySelector('h1');
      const paragraph = compiled.querySelector('p');

      expect(heading.textContent).toContain('Acceso Denegado');
      expect(paragraph.textContent).toContain('No tienes permisos para acceder a esta página');
    });

    it('should render two buttons', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });
  });
});

// Helper function to create a mock JWT token
function createMockToken(role: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ role, exp: Date.now() + 3600 }));
  const signature = 'mock-signature';
  return `${header}.${payload}.${signature}`;
}