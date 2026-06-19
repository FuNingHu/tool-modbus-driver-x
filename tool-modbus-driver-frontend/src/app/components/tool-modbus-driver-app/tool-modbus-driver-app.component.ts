import { TranslateService } from '@ngx-translate/core';
import { first } from 'rxjs/operators';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { ApplicationPresenterAPI, ApplicationPresenter, RobotSettings } from '@universal-robots/contribution-api';
import { MonitorSignal, ToolModbusDriverAppNode } from './tool-modbus-driver-app.node';
import { XmlRpcClient } from '../xmlrpc/xmlrpc-client';
import { URCAP_ID, VENDOR_ID } from 'src/generated/contribution-constants';

@Component({
    templateUrl: './tool-modbus-driver-app.component.html',
    styleUrls: ['./tool-modbus-driver-app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ToolModbusDriverAppComponent implements ApplicationPresenter, OnChanges, OnDestroy {
    // applicationAPI is optional
    @Input() applicationAPI: ApplicationPresenterAPI;
    // robotSettings is optional
    @Input() robotSettings: RobotSettings;
    // applicationNode is required
    @Input() applicationNode: ToolModbusDriverAppNode;

    private xmlrpc: XmlRpcClient;
    response: Promise<string> | null = null;
    options = ['1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'];

    // whether the modbus master is currently open
    connected = false;
    // live value read from each monitored register, aligned with monitorSignals index
    monitorValues: string[] = [];
    private monitorTimers: Array<ReturnType<typeof setInterval>> = [];
    // Modbus RTU is a half-duplex bus, so all reads must be serialized to avoid
    // colliding on the shared serial line. Each tick is queued onto a single chain,
    // and a signal can have at most one pending read to avoid backlog.
    private readChain: Promise<void> = Promise.resolve();
    private monitorPending: boolean[] = [];
    private readonly modbusPort = '/dev/ur-ttylink/ttyTool';

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
            this.xmlrpc.methodCall('isConnected').then(res => {
                this.connected = res === 'true' || (res as unknown) === true;
                this.restartMonitors();
                this.cd.detectChanges();
            });
        }
    }

    ngOnDestroy(): void {
        this.stopMonitors();
    }

    get signals(): MonitorSignal[] {
        return this.applicationNode?.monitorSignals ?? [];
    }

    handleToggle(): void {
        this.applicationNode.isSimulation = !this.applicationNode.isSimulation;
        this.saveNode();
    }

    async onActionButtonClick(): Promise<void> {
        if (!this.xmlrpc) {
            return;
        }
        try {
            if (this.connected) {
                await this.xmlrpc.methodCall('closeMaster');
                this.connected = false;
                this.stopMonitors();
            } else {
                const result = await this.xmlrpc.methodCall(
                    'openMaster',
                    this.modbusPort,
                    String(this.applicationNode.baudrate),
                    Number(this.applicationNode.deviceAddress)
                );
                this.connected = result === 'OK';
                if (this.connected) {
                    this.restartMonitors();
                }
            }
        } catch {
            this.connected = false;
            this.stopMonitors();
        } finally {
            this.cd.detectChanges();
        }
    }

    addSignal(): void {
        const name = this.generateSignalName(this.signals.map(signal => signal.name));
        const lastSignal = this.signals[this.signals.length - 1];
        const register = lastSignal ? Number(lastSignal.register) + 1 : 0;
        this.applicationNode.monitorSignals = [...this.signals, { name, register, frequency: 1 }];
        this.saveNode();
        this.restartMonitors();
    }

    // generate a unique default name: RTU, RTU_1, RTU_2, ...
    private generateSignalName(existing: string[]): string {
        const base = 'RTU';
        if (!existing.includes(base)) {
            return base;
        }
        let suffix = 1;
        while (existing.includes(`${base}_${suffix}`)) {
            suffix++;
        }
        return `${base}_${suffix}`;
    }

    onSignalNameChanged(index: number, value: unknown): void {
        const signal = this.signals[index];
        if (!signal) {
            return;
        }
        signal.name = String(value ?? '');
        this.saveNode();
    }

    removeSignal(index: number): void {
        const signals = [...this.signals];
        signals.splice(index, 1);
        this.applicationNode.monitorSignals = signals;
        this.saveNode();
        this.restartMonitors();
    }

    onSignalRegisterChanged(index: number, value: unknown): void {
        const signal = this.signals[index];
        if (!signal) {
            return;
        }
        signal.register = Number(value);
        this.saveNode();
    }

    onSignalFrequencyChanged(index: number, value: unknown): void {
        const signal = this.signals[index];
        if (!signal) {
            return;
        }
        signal.frequency = Number(value);
        this.saveNode();
        this.restartMonitors();
    }

    trackBySignal(index: number): number {
        return index;
    }

    private restartMonitors(): void {
        this.stopMonitors();
        this.monitorValues = this.signals.map(() => '-');
        this.monitorPending = this.signals.map(() => false);
        this.readChain = Promise.resolve();
        if (!this.xmlrpc || !this.connected) {
            return;
        }
        this.signals.forEach((signal, index) => {
            const frequency = Number(signal?.frequency);
            if (!frequency || frequency <= 0) {
                return;
            }
            const intervalMs = Math.max(50, Math.round(1000 / frequency));
            this.monitorTimers[index] = setInterval(() => this.enqueueRead(index), intervalMs);
        });
    }

    // queue a read for the given signal onto the serial chain (at most one pending per signal)
    private enqueueRead(index: number): void {
        if (!this.xmlrpc || !this.connected || this.monitorPending[index]) {
            return;
        }
        this.monitorPending[index] = true;
        this.readChain = this.readChain.then(() => this.readSignalValue(index));
    }

    private stopMonitors(): void {
        this.monitorTimers.forEach(timer => {
            if (timer) {
                clearInterval(timer);
            }
        });
        this.monitorTimers = [];
    }

    private async readSignalValue(index: number): Promise<void> {
        const signal = this.signals[index];
        if (!this.xmlrpc || !this.connected || !signal) {
            this.monitorPending[index] = false;
            return;
        }
        try {
            const register = Number(signal.register) || 0;
            const res = await this.xmlrpc.methodCall('tool_modbus_read', register, 1) as unknown;
            this.monitorValues[index] = Array.isArray(res) ? String(res[0]) : String(res);
        } catch {
            this.monitorValues[index] = '-';
        } finally {
            this.monitorPending[index] = false;
            this.cd.detectChanges();
        }
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
