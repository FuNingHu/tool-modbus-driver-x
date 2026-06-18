import {ComponentFixture, TestBed} from '@angular/core/testing';
import { ToolModbusDriverAppComponent} from "./ToolModbusDriverApp.component";
import {TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {Observable, of} from "rxjs";

describe('ToolModbusDriverAppComponent', () => {
  let fixture: ComponentFixture<ToolModbusDriverAppComponent>;
  let component: ToolModbusDriverAppComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ToolModbusDriverAppComponent],
      imports: [TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader, useValue: {
            getTranslation(): Observable<Record<string, string>> {
              return of({});
            }
          }
        }
      })],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolModbusDriverAppComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });
});
