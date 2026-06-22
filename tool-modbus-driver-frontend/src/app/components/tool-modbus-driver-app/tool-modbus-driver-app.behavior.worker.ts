/// <reference lib="webworker" />
import {
    ApplicationBehaviors,
    ApplicationNode, OptionalPromise,
    PopupLevel,
    registerApplicationBehavior,
    ScriptBuilder
} from '@universal-robots/contribution-api';
import { ToolModbusDriverAppNode } from './tool-modbus-driver-app.node';
import { URCAP_ID, VENDOR_ID } from 'src/generated/contribution-constants';
import { DEFAULT_AUTO_INCREMENT, DEFAULT_VERIFICATION } from '../constants';

// factory is required
const createApplicationNode = (): OptionalPromise<ToolModbusDriverAppNode> => ({
    type: 'funh-tool-modbus-driver-tool-modbus-driver-app',    // type is required
    version: '1.0.0',     // version is required
    deviceAddress: 1,
    baudrate: '9600',
    verification: DEFAULT_VERIFICATION,
    isSimulation: false,
    isConnect: false,
    monitorSignals: [{ mode: 'Read', name: 'RTU', register: 0, frequency: 1, writeValue: 0, autoIncrement: DEFAULT_AUTO_INCREMENT }]
});

// generatePreamble is optional
const generatePreambleScriptCode = async (node: ToolModbusDriverAppNode): Promise<ScriptBuilder> => {
    const builder = new ScriptBuilder();
    const url = `servicegateway/${VENDOR_ID}/${URCAP_ID}/tool-modbus-driver-backend/xmlrpc`;
    builder.assign('tool_modbus_driver',`rpc_factory("xmlrpc","${location.protocol}//${url}/")`);
    if(node.isConnect){
        builder.popup('Tool Modbus Driver Applicationis connected, please disconnect first.', 'Tool Modbus Driver', PopupLevel.WARNING, true);
        builder.halt();
    }
    if (!node.isSimulation) {
        // map the Verification dropdown to set_tool_communication's parity arg:
        // 0 = none, 1 = odd, 2 = even (stop_bits is fixed to 1)
        const parity = node.verification?.startsWith('Odd') ? 1 : node.verification?.startsWith('Even') ? 2 : 0;
        builder.addStatements('set_tool_voltage(24)');
        builder.addStatements(`set_tool_communication(True, ${node.baudrate}, ${parity}, 1, 1.0, 3.5)`);
        builder.sleep(0.2);
        builder.addStatements(`tool_modbus_driver.openMaster("/dev/ur-ttylink/ttyTool", "${node.baudrate}", ${node.deviceAddress}, "${node.verification}")`);
        
        // builder.popup('Tool Modbus Driver is ready.', 'Tool_modbus_driver_ready', PopupLevel.INFO, true);
    }
    builder.addStatements(`####### Tool Modbus Functions Definitions #######`);
    builder.addStatements(`def close_modbus_master():`);
    builder.addStatements(`  return tool_modbus_driver.closeMaster()`)
    builder.addStatements(`end`);
    builder.addStatements(`def get_modbus_error_info():`);
    builder.addStatements(`  return tool_modbus_driver.getErrorInfo()`);
    builder.addStatements(`end`);
    builder.addStatements(`def get_modbus_my_id():`);
    builder.addStatements(`  return tool_modbus_driver.getMyId()`);
    builder.addStatements(`end`);
    builder.addStatements(`def is_tool_modbus_service_reachable():`);
    builder.addStatements(`  return tool_modbus_driver.isReachable()`);
    builder.addStatements(`end`);
    builder.addStatements(`def is_tool_modbus_connected():`);
    builder.addStatements(`  return tool_modbus_driver.isConnected()`);
    builder.addStatements(`end`);
    builder.addStatements(`def tool_modbus_open(com, bau, my_id):`);
    builder.addStatements(`  set_tool_voltage(24)`)
    builder.addStatements(`  set_tool_communication(True, bau, 0,1,1.0,3.5)`)
    builder.addStatements(`  return tool_modbus_driver.openMaster(com, bau, my_id)`);
    builder.addStatements(`end`);
    builder.addStatements(`def tool_modbus_read(register_address_start, count=1):`);
    builder.addStatements(`  return tool_modbus_driver.tool_modbus_read(register_address_start, count)`);
    builder.addStatements(`end`);
    builder.addStatements(`def tool_modbus_write(register_address_start, data, count=1):`);
    builder.addStatements(`  return tool_modbus_driver.tool_modbus_write(register_address_start, data, count)`);
    builder.addStatements(`end`);
    builder.addStatements(`####### Tool Modbus Functions Definitions End #######`);
    
    return builder;
};

// upgradeNode is optional
const upgradeApplicationNode
  = (loadedNode: ApplicationNode, defaultNode: ToolModbusDriverAppNode): ToolModbusDriverAppNode =>
      defaultNode;

// downgradeNode is optional
const downgradeApplicationNode
  = (loadedNode: ApplicationNode, defaultNode: ToolModbusDriverAppNode): ToolModbusDriverAppNode =>
      defaultNode;

const behaviors: ApplicationBehaviors = {
    factory: createApplicationNode,
    generatePreamble: generatePreambleScriptCode,
    upgradeNode: upgradeApplicationNode,
    downgradeNode: downgradeApplicationNode
};

registerApplicationBehavior(behaviors);
