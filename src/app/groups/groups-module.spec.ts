import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GroupsModule } from './groups-module';

describe('GroupsModule', () => {
  let component: GroupsModule;
  let fixture: ComponentFixture<GroupsModule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GroupsModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupsModule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
