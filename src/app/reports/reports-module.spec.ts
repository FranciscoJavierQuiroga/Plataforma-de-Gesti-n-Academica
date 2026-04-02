import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReportsModule } from './reports-module';

describe('ReportsModule', () => {
  let component: ReportsModule;
  let fixture: ComponentFixture<ReportsModule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReportsModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsModule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
