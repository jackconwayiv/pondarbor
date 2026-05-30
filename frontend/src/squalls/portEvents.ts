import type { EventType } from "./shantiesTypes";

export const PORT_TOWN_EVENT: EventType = {
  name: "Port Town",
  type: "port",
};

export const PORT_POOL_CHANCE = 0.35;

export function isPortTownEvent(event: EventType): boolean {
  return event.type === "port" && event.name === PORT_TOWN_EVENT.name;
}
