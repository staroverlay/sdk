import { Emitter } from "./emitter";
import { IIntegration, IWidget, State } from "./types";


export class StarOverlaySDK extends Emitter {
    public state: State = "loading";
    public settings: Record<string, any> = {};
    public widgetToken: string | null;
    public widget: Partial<IWidget> = {};
    public preview: boolean;
    public backendUrl: string;
    public uploadContentUrl: string;
    public enabled: boolean = true;
    public integrations: IIntegration[] = [];
    public error: string | null = null;
    public socket: WebSocket | null = null;

    private subscriptions: Array<{ integrationId: string; eventId: string }> = [];

    constructor() {
        super();
        const urlParams = new URL(window.location.href).searchParams;
        this.widgetToken = urlParams.get('token');
        this.preview = urlParams.get('preview') === 'true';

        // @ts-ignore
        this.backendUrl = urlParams.get('apiUrl') ?? import.meta.env.VITE_API_URL ?? "https://api.staroverlay.com";

        // @ts-ignore
        this.uploadContentUrl = urlParams.get('mediaUrl') ?? import.meta.env.VITE_MEDIA_URL ?? "https://cdn.staroverlay.com";

        this.init().catch(err => {
            console.error("StarOverlay: Critical init error", err);
            this.error = err instanceof Error ? err.message : String(err);
            this.setState("error");
        });
    }

    /**
     * Resolve a relative media path to an absolute URL
     */
    public media(path: string | null): string | null {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const base = this.uploadContentUrl.replace(/\/$/, '');
        const p = path.startsWith('/') ? path : `/${path}`;
        return `${base}${p}`;
    }

    /**
     * Update the widget state and notify subscribers
     */
    public setState(newState: State) {
        this.state = newState;
        const appEl = document.getElementById('app') as any;
        if (appEl) {
            // For backward compatibility with CSS/Logic
            appEl.state = newState;
            appEl.setAttribute('state', newState);
        }
        this.emit('state:change', newState);
    }

    /**
     * Subscribe to events from a specific integration
     */
    public subscribe<T = any>(integrationId: string, eventId: string, callback?: (data: T) => void) {
        if (!integrationId || !this.integrations.some(i => i.id === integrationId)) {
            console.warn(`StarOverlay: Integration ${integrationId} not found`);
            return false;
        }

        const topic = `${integrationId}.${eventId}`;
        const alreadySubscribed = this.subscriptions.some(
            s => s.integrationId === integrationId && s.eventId === eventId
        );

        if (!alreadySubscribed) {
            this.subscriptions.push({ integrationId, eventId });
            this.send("subscribe", { integrationId, eventId });
        }

        if (callback) {
            this.on(`event:${topic}`, callback);
        }

        return true;
    }

    /**
     * Send a raw message to the backend via WebSocket
     */
    public send(event: string, data: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ event, data }));
        }
    }

    private async init() {
        if (!this.widgetToken) {
            console.warn("StarOverlay: Widget token missing in URL (?token=...)");
            this.error = "Missing token";
            this.setState("error");
            return;
        }

        const wsUrl = this.backendUrl.replace(/^http/, 'ws') + "/events/widget?token=" + encodeURIComponent(this.widgetToken);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("StarOverlay: Connected to server");
            // Resubscribe to existing topics on reconnection
            this.subscriptions.forEach(sub => {
                this.send("subscribe", sub);
            });
        };

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                console.log("StarOverlay: Received message", payload);

                if (payload.event === "widget:data") {
                    const data = payload.data;
                    this.widget = data;
                    this.integrations = data.integrations || [];

                    try {
                        this.settings = typeof data.settings === 'string'
                            ? JSON.parse(data.settings)
                            : (data.settings || {});
                    } catch (e) {
                        console.error("StarOverlay: Failed to parse widget settings", e);
                        this.settings = {};
                    }

                    this.enabled = data.enabled !== false;
                    this.setState("ok");
                    this.emit("ready", this);
                }

                if (payload.event === "widget:settings_update") {
                    this.settings = payload.data;
                    this.emit("update", this.settings);
                }

                if (payload.event === "widget:toggle") {
                    this.enabled = payload.data.enabled !== false;
                    this.emit("toggle", this.enabled);
                    if (!this.enabled) {
                        // Optionally handle disabled state
                    } else {
                        this.setState("ok");
                    }
                }

                if (payload.event === "integration:event") {
                    const { integrationId, eventId, event: eventData } = payload.data;
                    const topic = `${integrationId}.${eventId}`;
                    this.emit(`event:${topic}`, eventData);
                }

                // Generic event emission
                if (payload.event) {
                    this.emit(payload.event, payload.data);
                }
            } catch (e) {
                if (event.data === "pong") {
                    this.emit("pong");
                } else {
                    console.error("Error parsing message", e);
                }
            }
        };

        socket.onerror = (err) => {
            console.error("StarOverlay: WebSocket error", err);
            this.error = "WebSocket error";
            this.setState("error");
            this.emit("error", err);
        };

        socket.onclose = (event) => {
            console.log("StarOverlay: Disconnected", event.code, event.reason);
            this.setState("loading");

            // Auto-reconnect after 3 seconds
            setTimeout(() => {
                console.log("StarOverlay: Attempting to reconnect...");
                this.init();
            }, 3000);
        };

        this.socket = socket;
    }
}
