#!/usr/bin/env python
# coding:utf-8

import sys
import threading
import time
from socketserver import ThreadingMixIn
from xmlrpc.server import SimpleXMLRPCRequestHandler, SimpleXMLRPCServer

import minimalmodbus
import serial


XMLRPC_PORT = 54321
myId = "9"
master = None
connectState = "false"
# Modbus RTU is a half-duplex bus: serialize "set slave address + transaction"
# so concurrent reads/writes to different slave ids cannot interleave.
_bus_lock = threading.Lock()


def _parse_register_values(data):
    if isinstance(data, (list, tuple)):
        return [int(value) & 0xFFFF for value in data]
    return [int(value.strip()) & 0xFFFF for value in str(data).split(",") if value.strip()]


def closeMaster():
    try:
        time.sleep(1)
        global master, connectState
        if master is not None and getattr(master, "serial", None) is not None:
            master.serial.close()
        master = None
        connectState = "false"
        return "OK"
    except Exception as exc:
        return str(exc)


def getErrorInfo():
    try:
        read_buf = master.read_registers(2001, 1, functioncode=3)
        return str(read_buf[0] & 0xff)
    except Exception:
        return "error"


def getMyId():
    return myId


def isReachable():
    return True


def isConnected():
    return connectState


def _resolve_parity(verification):
    # accepts the Verification dropdown string ("None 8 1" / "Odd 8 1" / "Even 8 1"),
    # a parity code (0/1/2) or a parity letter (N/O/E); defaults to none.
    token = str(verification).strip().lower()
    if token.startswith("odd") or token in ("1", "o"):
        return serial.PARITY_ODD
    if token.startswith("even") or token in ("2", "e"):
        return serial.PARITY_EVEN
    return serial.PARITY_NONE


def openMaster(com, bau, newId, verification="None"):
    try:
        global master, connectState, myId
        myId = str(newId)
        master = minimalmodbus.Instrument(com, int(myId))
        master.serial.baudrate = int(bau)
        master.serial.bytesize = 8
        master.serial.parity = _resolve_parity(verification)
        master.serial.stopbits = serial.STOPBITS_ONE
        master.serial.timeout = 1.0
        master.mode = minimalmodbus.MODE_RTU
        master.clear_buffers_before_each_transaction = True
        connectState = "true"
        return "OK"
    except Exception as exc:
        master = None
        connectState = "false"
        print(f"Error: {exc}")
        return str(exc)


def scanDeviceAddress(com, bau, startId=1, endId=247):
    # Probe each slave address; a timeout/no-answer means no device there,
    # while any other reply (success or a Modbus slave exception) means a
    # device is present at that address. Used to find an unknown slave address.
    global master, connectState
    try:
        # free the serial port if a master is currently open
        if master is not None and getattr(master, "serial", None) is not None:
            master.serial.close()
        master = None
        connectState = "false"

        found = []
        for sid in range(int(startId), int(endId) + 1):
            try:
                instr = minimalmodbus.Instrument(com, sid)
                instr.serial.baudrate = int(bau)
                instr.serial.bytesize = 8
                instr.serial.parity = serial.PARITY_NONE
                instr.serial.stopbits = serial.STOPBITS_ONE
                instr.serial.timeout = 0.15
                instr.mode = minimalmodbus.MODE_RTU
                instr.clear_buffers_before_each_transaction = True
                hit = False
                try:
                    instr.read_registers(0, 1, functioncode=3)
                    found.append(f"{sid}:OK")
                    hit = True
                except Exception as exc:
                    msg = str(exc).lower()
                    if "no communication" in msg or "no answer" in msg or "timeout" in msg:
                        pass  # nothing answered at this address
                    elif "crc" in msg or "invalid response" in msg or "registered" in msg:
                        pass  # garbled frame, likely wrong baudrate
                    else:
                        # device answered with a Modbus exception => it exists here
                        found.append(f"{sid}:{exc}")
                        hit = True
                finally:
                    instr.serial.close()
                # stop scanning as soon as a device answers
                if hit:
                    return found
            except Exception as exc:
                return [f"error:{exc}"]
        return found
    except Exception as exc:
        return [f"error:{exc}"]


def tool_modbus_read(register_address, count=1, slave_id=None):
    try:
        with _bus_lock:
            # optionally target a specific slave on the shared bus
            if slave_id is not None and str(slave_id) != "" and int(slave_id) > 0:
                master.address = int(slave_id)
            read_buf = master.read_registers(int(register_address), int(count), functioncode=3)
        return [str(value & 0xFFFF) for value in read_buf]
    except Exception as exc:
        return [str(exc)]


def tool_modbus_write(register_address, data, count=1, slave_id=None):
    try:
        values = _parse_register_values(data)
        expected_count = int(count)

        if len(values) == 0:
            return "No register values provided"
        if expected_count != len(values):
            return "Count does not match register value length"

        with _bus_lock:
            # optionally target a specific slave on the shared bus
            if slave_id is not None and str(slave_id) != "" and int(slave_id) > 0:
                master.address = int(slave_id)
            if expected_count == 1:
                master.write_register(int(register_address), values[0], 0, functioncode=6)
            else:
                master.write_registers(int(register_address), values)
        return "OK"
    except Exception as exc:
        return str(exc)


class RequestHandler(SimpleXMLRPCRequestHandler):
    rpc_paths = ('/',)

    def log_message(self, format, *args):
        pass


class MultithreadedSimpleXMLRPCServer(ThreadingMixIn, SimpleXMLRPCServer):
    pass


sys.stdout.write("Tool Modbus Driver daemon started")
sys.stderr.write("Tool Modbus Driver daemon started")

server = MultithreadedSimpleXMLRPCServer(("0.0.0.0", XMLRPC_PORT), requestHandler=RequestHandler)
server.RequestHandlerClass.protocol_version = "HTTP/1.1"

server.register_function(closeMaster, "closeMaster")
server.register_function(getErrorInfo, "getErrorInfo")
server.register_function(getMyId, "getMyId")
server.register_function(isReachable, "isReachable")
server.register_function(isConnected, "isConnected")
server.register_function(openMaster, "openMaster")
server.register_function(scanDeviceAddress, "scanDeviceAddress")
server.register_function(tool_modbus_read, "tool_modbus_read")
server.register_function(tool_modbus_write, "tool_modbus_write")
server.serve_forever()
