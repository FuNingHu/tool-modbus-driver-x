/// <reference lib="webworker" />
import {
    AdvancedTranslatedProgramLabel,
    InsertionContext,
    OptionalPromise,
    ProgramBehaviors,
    ProgramNode,
    registerProgramBehavior,
    ScriptBuilder,
    ValidationContext,
    ValidationResponse
} from '@universal-robots/contribution-api';
import { ToolModbusDriverPgNode } from './tool-modbus-driver-pg.node';

// programNodeLabel is required
const createProgramNodeLabel = (node: ToolModbusDriverPgNode): AdvancedTranslatedProgramLabel => {
    return [
        {
            type: 'primary',
            translationKey: 'program-node-labels.tool-modbus-driver-pg.nodeTitle',
        },
        {
            type: 'secondary',
            translationKey: 'program-node-labels.tool-modbus-driver-pg.subTitle',
            interpolateParams: { dynamicValue: 'some dynamic value' },
        },
    ];
};

// factory is required
const createProgramNode = (): OptionalPromise<ToolModbusDriverPgNode> => ({
    type: 'funh-tool-modbus-driver-tool-modbus-driver-pg',
    version: '1.0.0',
    lockChildren: false,
    allowsChildren: false,
    parameters: {
    },
});

// generateCodeBeforeChildren is optional
const generateScriptCodeBefore = (node: ToolModbusDriverPgNode): OptionalPromise<ScriptBuilder> => new ScriptBuilder();

// generateCodeAfterChildren is optional
const generateScriptCodeAfter = (node: ToolModbusDriverPgNode): OptionalPromise<ScriptBuilder> => new ScriptBuilder();

// generateCodePreamble is optional
const generatePreambleScriptCode = (node: ToolModbusDriverPgNode): OptionalPromise<ScriptBuilder> => new ScriptBuilder();

// validator is optional
const validate = (node: ToolModbusDriverPgNode, validationContext: ValidationContext): OptionalPromise<ValidationResponse> => ({
    isValid: true
});

// allowsChild is optional
const allowChildInsert = (node: ProgramNode, childType: string): OptionalPromise<boolean> => true;

// allowedInContext is optional
const allowedInsert = (insertionContext: InsertionContext): OptionalPromise<boolean> => true;

// upgradeNode is optional
const nodeUpgrade = (loadedNode: ProgramNode): ProgramNode => loadedNode;

const behaviors: ProgramBehaviors = {
    programNodeLabel: createProgramNodeLabel,
    factory: createProgramNode,
    generateCodeBeforeChildren: generateScriptCodeBefore,
    generateCodeAfterChildren: generateScriptCodeAfter,
    generateCodePreamble: generatePreambleScriptCode,
    validator: validate,
    allowsChild: allowChildInsert,
    allowedInContext: allowedInsert,
    upgradeNode: nodeUpgrade
};

registerProgramBehavior(behaviors);
