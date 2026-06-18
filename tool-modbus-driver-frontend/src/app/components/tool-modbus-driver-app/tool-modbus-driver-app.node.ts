import { ApplicationNode } from '@universal-robots/contribution-api';

export interface ToolModbusDriverAppNode extends ApplicationNode {
  type: string;
  version: string;
  deviceAddress: number;
  baudrate: string;
  isSimulation: boolean;
}
