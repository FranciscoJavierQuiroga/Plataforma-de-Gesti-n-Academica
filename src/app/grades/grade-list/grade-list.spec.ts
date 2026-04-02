import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GradeList } from './grade-list';

describe('GradeList', () => {
  let component: GradeList;
  let fixture: ComponentFixture<GradeList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GradeList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
