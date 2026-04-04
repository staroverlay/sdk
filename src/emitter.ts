import { TwitchEventType } from "./types/twitch-types";

export type PlatformEventType =
    | "ready"
    | "state:change"
    | "update"
    | "toggle"
    | "pong"
    | "error";

export interface IEvent {
    event: PlatformEventType | TwitchEventType | (string & {});
    data: any;
}

export class Emitter {
    private _events: Record<string, Function[]> = {};

    /**
     * Listen for events from the SDK or integrations
     */
    public on<T = any>(event: PlatformEventType | TwitchEventType | (string & {}), callback: (data: T) => void) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
        return () => this.off(event, callback);
    }

    /**
     * Stop listening for an event
     */
    public off(event: PlatformEventType | TwitchEventType | (string & {}), callback: Function) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(cb => cb !== callback);
    }

    /**
     * Emit an internal event
     */
    public emit(event: PlatformEventType | TwitchEventType | (string & {}), data?: any) {
        if (this._events[event]) {
            this._events[event].forEach(cb => cb(data));
        }
    }
}
