import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GradesModule } from './grades-module';

describe('GradesModule', () => {
  let component: GradesModule;
  let fixture: ComponentFixture<GradesModule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GradesModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GradesModule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
