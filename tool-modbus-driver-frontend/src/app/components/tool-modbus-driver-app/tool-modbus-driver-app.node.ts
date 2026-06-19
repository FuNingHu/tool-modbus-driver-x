import { ApplicationNode } from '@universal-robots/contribution-api';

export interface MonitorSignal {
  name: string;
  register: number;
  frequency: number;
}

export interface ToolModbusDriverAppNode extends ApplicationNode {
  type: string;
  version: string;
  deviceAddress: number;
  baudrate: string;
  isSimulation: boolean;
  monitorSignals: MonitorSignal[];
}
