import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GradeReport } from './grade-report';

describe('GradeReport', () => {
  let component: GradeReport;
  let fixture: ComponentFixture<GradeReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GradeReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
