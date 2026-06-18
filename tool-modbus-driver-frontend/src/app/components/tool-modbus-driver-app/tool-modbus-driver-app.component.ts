import { TranslateService } from '@ngx-translate/core';
import { first } from 'rxjs/operators';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ApplicationPresenterAPI, ApplicationPresenter, RobotSettings } from '@universal-robots/contribution-api';
import { ToolModbusDriverAppNode } from './tool-modbus-driver-app.node';
import { XmlRpcClient } from '../xmlrpc/xmlrpc-client';
import { URCAP_ID, VENDOR_ID } from 'src/generated/contribution-constants';

@Component({
    templateUrl: './tool-modbus-driver-app.component.html',
    styleUrls: ['./tool-modbus-driver-app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ToolModbusDriverAppComponent implements ApplicationPresenter, OnChanges {
    // applicationAPI is optional
    @Input() applicationAPI: ApplicationPresenterAPI;
    // robotSettings is optional
    @Input() robotSettings: RobotSettings;
    // applicationNode is required
    @Input() applicationNode: ToolModbusDriverAppNode;

    private xmlrpc: XmlRpcClient;
    response: Promise<string> | null = null;
    options = ['1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'];

    constructor(
        protected readonly translateService: TranslateService,
        protected readonly cd: ChangeDetectorRef
    ) {
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes?.robotSettings) {
            if (!changes?.robotSettings?.currentValue) {
                return;
            }

            if (changes?.robotSettings?.isFirstChange()) {
                if (changes?.robotSettings?.currentValue) {
                    this.translateService.use(changes?.robotSettings?.currentValue?.language);
                }
                this.translateService.setDefaultLang('en');
            }

            this.translateService
                .use(changes?.robotSettings?.currentValue?.language)
                .pipe(first())
                .subscribe(() => {
                    this.cd.detectChanges();
                });
            const url = this.applicationAPI.getContainerContributionURL(VENDOR_ID, URCAP_ID, 'tool-modbus-driver-backend', 'xmlrpc');
            this.xmlrpc = new XmlRpcClient(`${location.protocol}//${url}/`);
            this.xmlrpc.methodCall('isReachable').then(res => {
                console.log('tool modbus driver daemon isReachable: ', res);
            });
        }
    }

    handleToggle(): void {
        this.applicationNode.isSimulation = !this.applicationNode.isSimulation;
        this.saveNode();
    }

    onBaudrateSelectionChange(event: unknown): void {
        const value =
            event && typeof event === 'object' && 'value' in event
                ? (event as { value: unknown }).value
                : event;
        this.applicationNode.baudrate = String(value);
        this.saveNode();
    }

    onDeviceAddressChanged(value: unknown): void {
        this.applicationNode.deviceAddress = Number(value);
        this.saveNode();
    }

    // call saveNode to save node parameters
    saveNode() {
        this.cd.detectChanges();
        this.applicationAPI.applicationNodeService.updateNode(this.applicationNode);
    }
}
