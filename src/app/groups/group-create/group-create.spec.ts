import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupCreate } from './group-create';

describe('GroupCreate', () => {
  let component: GroupCreate;
  let fixture: ComponentFixture<GroupCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
