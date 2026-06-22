import { ApplicationNode } from '@universal-robots/contribution-api';

export interface MonitorSignal {
  mode: string;
  name: string;
  register: number;
  frequency: number;
  writeValue: number;
  autoIncrement: boolean;
}

export interface ToolModbusDriverAppNode extends ApplicationNode {
  type: string;
  version: string;
  deviceAddress: number;
  baudrate: string;
  verification: string;
  isSimulation: boolean;
  isConnect: boolean;
  monitorSignals: MonitorSignal[];
}
