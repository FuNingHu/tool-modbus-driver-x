#!/usr/bin/env python
# coding:utf-8

import sys
import time
from socketserver import ThreadingMixIn
from xmlrpc.server import SimpleXMLRPCRequestHandler, SimpleXMLRPCServer

import minimalmodbus
import serial


XMLRPC_PORT = 54321
myId = "9"
master = None
connectState = "false"


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


def openMaster(com, bau, newId):
    try:
        global master, connectState, myId
        myId = str(newId)
        master = minimalmodbus.Instrument(com, int(myId))
        master.serial.baudrate = int(bau)
        master.serial.bytesize = 8
        master.serial.parity = serial.PARITY_NONE
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


def tool_modbus_read(register_address, count=1):
    try:
        read_buf = master.read_registers(int(register_address), int(count), functioncode=3)
        return [str(value & 0xFFFF) for value in read_buf]
    except Exception as exc:
        return [str(exc)]


def tool_modbus_write(register_address, data, count=1):
    try:
        values = _parse_register_values(data)
        expected_count = int(count)

        if len(values) == 0:
            return "No register values provided"
        if expected_count != len(values):
            return "Count does not match register value length"

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
server.register_function(tool_modbus_read, "tool_modbus_read")
server.register_function(tool_modbus_write, "tool_modbus_write")
server.serve_forever()
