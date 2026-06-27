import { TranslateService } from '@ngx-translate/core';
import { first } from 'rxjs/operators';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { ApplicationPresenterAPI, ApplicationPresenter, RobotSettings } from '@universal-robots/contribution-api';
import { MonitorSignal, ToolModbusDriverAppNode } from './tool-modbus-driver-app.node';
import { XmlRpcClient } from '../xmlrpc/xmlrpc-client';
import { URCAP_ID, VENDOR_ID } from 'src/generated/contribution-constants';
import { BAUDRATE_OPTIONS, DEFAULT_AUTO_INCREMENT, DEFAULT_CONNECTED, MODE_OPTIONS, VERIFICATION_OPTIONS } from '../constants';

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
    options = BAUDRATE_OPTIONS;
    modeOptions = MODE_OPTIONS;
    verificationOptions = VERIFICATION_OPTIONS;

    // whether the modbus master is currently open
    connected = DEFAULT_CONNECTED;
    // whether an address scan is currently running
    scanning = false;
    // addresses found by the last scan (comma-separated), or null
    foundAddress: string | null = null;
    // estimated remaining scan time in seconds
    scanRemaining = 0;
    private scanCountdownTimer?: ReturnType<typeof setInterval>;
    private readonly scanCount = 247;
    private readonly scanSecondsPerAddress = 0.2;
    // live value read from each monitored register, aligned with monitorSignals index
    monitorValues: string[] = [];
    private monitorTimers: Array<ReturnType<typeof setInterval>> = [];
    // Modbus RTU is a half-duplex bus, so all reads must be serialized to avoid
    // colliding on the shared serial line. Each tick is queued onto a single chain,
    // and a signal can have at most one pending read to avoid backlog.
    private readChain: Promise<void> = Promise.resolve();
    private monitorPending: boolean[] = [];
    private readonly modbusPort = '/dev/ur-ttylink/ttyTool';
    // ensure the tool_modbus application variable is only created once

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
                this.setConnected(res === 'true' || (res as unknown) === true);
                this.restartMonitors();
                this.cd.detectChanges();
            });
        }
    }

    ngOnDestroy(): void {
        this.stopMonitors();
        this.stopScanCountdown();
    }


    // remaining scan time formatted as mm:ss
    get scanRemainingText(): string {
        const total = Math.max(0, this.scanRemaining);
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    get signals(): MonitorSignal[] {
        return this.applicationNode?.monitorSignals ?? [];
    }

    handleToggle(): void {
        this.applicationNode.isSimulation = !this.applicationNode.isSimulation;
        this.saveNode();
    }

    // keep the connection flag and the persisted node in sync; isConnect mirrors
    // the action button state (true while it shows "Disconnect")
    private setConnected(value: boolean): void {
        this.connected = value;
        if (this.applicationNode && this.applicationNode.isConnect !== value) {
            this.applicationNode.isConnect = value;
            this.saveNode();
        }
    }

    async onActionButtonClick(): Promise<void> {
        if (!this.xmlrpc) {
            return;
        }
        try {
            if (this.connected) {
                await this.xmlrpc.methodCall('closeMaster');
                this.setConnected(false);
                this.stopMonitors();
            } else {
                const result = await this.xmlrpc.methodCall(
                    'openMaster',
                    this.modbusPort,
                    String(this.applicationNode.baudrate),
                    Number(this.applicationNode.deviceAddress),
                    String(this.applicationNode.verification ?? 'None')
                );
                this.setConnected(result === 'OK');
                if (this.connected) {
                    this.restartMonitors();
                }
            }
        } catch {
            this.setConnected(false);
            this.stopMonitors();
        } finally {
            this.cd.detectChanges();
        }
    }

    async onScanClick(): Promise<void> {
        if (!this.xmlrpc || this.scanning) {
            return;
        }
        // free the bus: stop polling and drop the connection before scanning
        this.setConnected(false);
        this.stopMonitors();
        this.foundAddress = null;
        this.scanning = true;
        this.scanRemaining = Math.ceil(this.scanCount * this.scanSecondsPerAddress);
        this.startScanCountdown();
        this.cd.detectChanges();
        try {
            console.log('Scanning Modbus addresses 1..247 at baudrate', this.applicationNode.baudrate, '...');
            const res = await this.xmlrpc.methodCall(
                'scanDeviceAddress',
                this.modbusPort,
                String(this.applicationNode.baudrate)
            );
            console.log('Modbus address scan result:', res);
            const addresses = Array.isArray(res)
                ? res
                    .map(item => String(item).split(':')[0].trim())
                    .filter(address => address !== '' && address.toLowerCase() !== 'error')
                : [];
            this.foundAddress = addresses.length ? addresses.join(', ') : null;
            if (addresses.length) {
                this.applicationAPI?.snackbarService?.showSnackbar(
                    `Found ${addresses.length} device(s). Device Address: ${addresses.join(', ')}`,
                    'success',
                    'Tool Modbus Driver Scan'
                );
            } else {
                this.applicationAPI?.snackbarService?.showSnackbar(
                    'Found 0 device',
                    'warning',
                    'Tool Modbus Driver Scan'
                );
            }
        } catch (err) {
            console.log('Modbus address scan failed:', err);
            this.foundAddress = null;
        } finally {
            this.stopScanCountdown();
            this.scanning = false;
            this.cd.detectChanges();
        }
    }

    private startScanCountdown(): void {
        this.stopScanCountdown();
        this.scanCountdownTimer = setInterval(() => {
            if (this.scanRemaining > 0) {
                this.scanRemaining--;
                this.cd.detectChanges();
            }
        }, 1000);
    }

    private stopScanCountdown(): void {
        if (this.scanCountdownTimer) {
            clearInterval(this.scanCountdownTimer);
            this.scanCountdownTimer = undefined;
        }
    }

    addSignal(): void {
        const name = this.generateSignalName(this.signals.map(signal => signal.name));
        const lastSignal = this.signals[this.signals.length - 1];
        const register = lastSignal ? Number(lastSignal.register) + 1 : 0;
        this.applicationNode.monitorSignals = [...this.signals, {
            mode: 'Read', name, register, frequency: 1, writeValue: 0, autoIncrement: DEFAULT_AUTO_INCREMENT
        }];
        this.saveNode();
        this.restartMonitors();
    }

    onSignalModeChanged(index: number, event: unknown): void {
        const signal = this.signals[index];
        if (!signal) {
            return;
        }
        const value =
            event && typeof event === 'object' && 'value' in event
                ? (event as { value: unknown }).value
                : event;
        signal.mode = String(value);
        this.saveNode();
        // Read rows poll the register, Write rows push the value; refresh the timers
        this.restartMonitors();
    }

    onSignalWriteValueChanged(index: number, value: unknown): void {
        const signal = this.signals[index];
        if (!signal) {
            return;
        }
        signal.writeValue = Number(value);
        this.saveNode();
    }

    onSignalAutoIncrementChanged(index: number, checked: unknown): void {
        const signal = this.signals[index];
        if (!signal) {
            return;
        }
        signal.autoIncrement = checked === true;
        this.saveNode();
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
            // Read rows poll the register; Write rows push the value (optionally auto-incrementing)
            const tick = signal?.mode === 'Write'
                ? () => this.enqueueBusOp(index, () => this.writeSignalValue(index))
                : () => this.enqueueBusOp(index, () => this.readSignalValue(index));
            this.monitorTimers[index] = setInterval(tick, intervalMs);
        });
    }

    // queue a bus operation for the given signal onto the serial chain
    // (at most one pending per signal; Modbus RTU is half-duplex so all ops are serialized)
    private enqueueBusOp(index: number, op: () => Promise<void>): void {
        if (!this.xmlrpc || !this.connected || this.monitorPending[index]) {
            return;
        }
        this.monitorPending[index] = true;
        this.readChain = this.readChain.then(op);
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

    private async writeSignalValue(index: number): Promise<void> {
        const signal = this.signals[index];
        if (!this.xmlrpc || !this.connected || !signal) {
            this.monitorPending[index] = false;
            return;
        }
        try {
            // when auto-increment is on, bump the value by 1 each tick before writing
            if (signal.autoIncrement) {
                signal.writeValue = (Number(signal.writeValue) || 0) + 1;
                this.saveNode();
            }
            const register = Number(signal.register) || 0;
            const value = Number(signal.writeValue) || 0;
            await this.xmlrpc.methodCall('tool_modbus_write', register, value, 1);
        } catch {
            // ignore transient write errors; next tick will retry
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

    onVerificationSelectionChange(event: unknown): void {
        const value =
            event && typeof event === 'object' && 'value' in event
                ? (event as { value: unknown }).value
                : event;
        this.applicationNode.verification = String(value);
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
