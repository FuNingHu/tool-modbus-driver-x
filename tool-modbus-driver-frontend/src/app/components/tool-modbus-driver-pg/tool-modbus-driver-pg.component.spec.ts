import {ComponentFixture, TestBed} from '@angular/core/testing';
import {tool-modbus-driver-pgComponent} from "./tool-modbus-driver-pg.component";
import {TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {Observable, of} from "rxjs";

describe('ToolModbusDriverPgComponent', () => {
  let fixture: ComponentFixture<ToolModbusDriverPgComponent>;
  let component: ToolModbusDriverPgComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ToolModbusDriverPgComponent],
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

    fixture = TestBed.createComponent(ToolModbusDriverPgComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });
});
