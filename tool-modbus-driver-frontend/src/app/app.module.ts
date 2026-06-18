import { DoBootstrap, Injector, NgModule } from '@angular/core';
import { ToolModbusDriverAppComponent } from './components/tool-modbus-driver-app/tool-modbus-driver-app.component';
import { ToolModbusDriverPgComponent } from './components/tool-modbus-driver-pg/tool-modbus-driver-pg.component';
import { ToolModbusDriverBarComponent } from './components/tool-modbus-driver-bar/tool-modbus-driver-bar.component';

import { UIAngularComponentsModule } from '@universal-robots/ui-angular-components';
import { BrowserModule } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { HttpBackend, HttpClientModule } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import {MultiTranslateHttpLoader} from 'ngx-translate-multi-http-loader';
import { PATH } from '../generated/contribution-constants';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";

export const httpLoaderFactory = (http: HttpBackend) =>
    new MultiTranslateHttpLoader(http, [
      { prefix: PATH + '/assets/i18n/', suffix: '.json' },
      { prefix: './ui/assets/i18n/', suffix: '.json' },
    ]);

@NgModule({

  declarations: [
      ToolModbusDriverAppComponent,
      ToolModbusDriverPgComponent,
      ToolModbusDriverBarComponent
],
    imports: [
      BrowserModule,
      BrowserAnimationsModule,
      UIAngularComponentsModule,
      HttpClientModule,
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useFactory: httpLoaderFactory, deps: [HttpBackend] },
        useDefaultLang: false,
      })
    ],
    providers: [],
})

export class AppModule implements DoBootstrap {
  constructor(private injector: Injector) {
  }

  ngDoBootstrap() {
    const toolmodbusdriverappComponent = createCustomElement(ToolModbusDriverAppComponent, {injector: this.injector});
    customElements.define('funh-tool-modbus-driver-tool-modbus-driver-app', toolmodbusdriverappComponent);
    const toolmodbusdriverpgComponent = createCustomElement(ToolModbusDriverPgComponent, {injector: this.injector});
    customElements.define('funh-tool-modbus-driver-tool-modbus-driver-pg', toolmodbusdriverpgComponent);
    const toolmodbusdriverbarComponent = createCustomElement(ToolModbusDriverBarComponent, {injector: this.injector});
    customElements.define('funh-tool-modbus-driver-tool-modbus-driver-bar', toolmodbusdriverbarComponent);
  }

  // This function is never called, because we don't want to actually use the workers, just tell webpack about them
  registerWorkersWithWebPack() {
    new Worker(new URL('./components/tool-modbus-driver-app/tool-modbus-driver-app.behavior.worker.ts'
        /* webpackChunkName: "tool-modbus-driver-app.worker" */, import.meta.url), {
      name: 'tool-modbus-driver-app',
      type: 'module'
    });new Worker(new URL('./components/tool-modbus-driver-pg/tool-modbus-driver-pg.behavior.worker.ts'
        /* webpackChunkName: "tool-modbus-driver-pg.worker" */, import.meta.url), {
      name: 'tool-modbus-driver-pg',
      type: 'module'
    });new Worker(new URL('./components/tool-modbus-driver-bar/tool-modbus-driver-bar.behavior.worker.ts'
        /* webpackChunkName: "tool-modbus-driver-bar.worker" */, import.meta.url), {
      name: 'tool-modbus-driver-bar',
      type: 'module'
    });
  }
}

