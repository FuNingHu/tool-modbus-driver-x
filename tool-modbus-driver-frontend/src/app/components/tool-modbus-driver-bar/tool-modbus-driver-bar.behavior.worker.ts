import {
  registerSidebarBehavior,
  SidebarItemBehaviors,
} from "@universal-robots/contribution-api";

const behaviors: SidebarItemBehaviors = {
  factory: () => {
    return {
      type: "funh-tool-modbus-driver-tool-modbus-driver-bar",
      version: "1.0.0",
    };
  },
};

registerSidebarBehavior(behaviors);
