// Centralized default values for the Tool Modbus Driver app component.

export const BAUDRATE_OPTIONS = ['9600', '19200', '38400', '57600', '115200', '1000000', '2000000', '5000000'];

export const MODE_OPTIONS = ['Read', 'Write'];

// serial verification options: parity / bytesize / stopbits
export const VERIFICATION_OPTIONS = ['None 8 1', 'Odd 8 1', 'Even 8 1'];

export const DEFAULT_VERIFICATION = 'None 8 1';

export const DEFAULT_CONNECTED = false;

// default state of the "auto increment by 1" checkbox on Write signals
export const DEFAULT_AUTO_INCREMENT = false;
