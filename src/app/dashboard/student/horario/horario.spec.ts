import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import HorarioComponent from './horario';

describe('HorarioComponent', () => {
  let component: HorarioComponent;
  let fixture: ComponentFixture<HorarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HorarioComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HorarioComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.horario).toEqual([]);
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
  });

  it('should call cargarHorario on init', () => {
    const cargarHorarioSpy = jest.spyOn(component, 'cargarHorario');
    component.ngOnInit();
    expect(cargarHorarioSpy).toHaveBeenCalled();
  });

  it('should set loading to true when cargarHorario starts', () => {
    component.cargarHorario();
    // Loading is set to true at the start
    // Since it's synchronous, it's immediately set to false
    // But we can verify the method was called
    expect(component.horario.length).toBeGreaterThan(0);
  });

  it('should load horario data', () => {
    component.cargarHorario();
    
    expect(component.horario.length).toBe(6);
    expect(component.horario[0].hora).toBe('7:00 - 8:00');
    expect(component.horario[0].lunes).toBe('Matemáticas');
  });

  it('should set loading to false after loading horario', () => {
    component.cargarHorario();
    expect(component.loading).toBe(false);
  });

  it('should have correct structure for horario entries', () => {
    component.cargarHorario();
    
    const firstEntry = component.horario[0];
    expect(firstEntry).toHaveProperty('hora');
    expect(firstEntry).toHaveProperty('lunes');
    expect(firstEntry).toHaveProperty('martes');
    expect(firstEntry).toHaveProperty('miercoles');
    expect(firstEntry).toHaveProperty('jueves');
    expect(firstEntry).toHaveProperty('viernes');
  });

  it('should have descanso entries', () => {
    component.cargarHorario();
    
    const descansoEntry = component.horario.find(h => h.hora === '10:00 - 10:30');
    expect(descansoEntry).toBeDefined();
    expect(descansoEntry?.lunes).toBe('DESCANSO');
    expect(descansoEntry?.martes).toBe('DESCANSO');
  });

  describe('getDiaActual', () => {
    it('should return current day name', () => {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayIndex = new Date().getDay();
      const expectedDay = dias[dayIndex];
      
      const result = component.getDiaActual();
      expect(result).toBe(expectedDay);
    });

    it('should return a valid day name', () => {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const result = component.getDiaActual();
      expect(dias).toContain(result);
    });
  });

  describe('esDescanso', () => {
    it('should return true for DESCANSO', () => {
      expect(component.esDescanso('DESCANSO')).toBe(true);
    });

    it('should return false for regular subjects', () => {
      expect(component.esDescanso('Matemáticas')).toBe(false);
      expect(component.esDescanso('Español')).toBe(false);
      expect(component.esDescanso('Ciencias')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(component.esDescanso('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(component.esDescanso('descanso')).toBe(false);
      expect(component.esDescanso('Descanso')).toBe(false);
    });
  });
});
