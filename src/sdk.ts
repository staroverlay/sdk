import { Emitter } from "./emitter";
import { IIntegration, IWidget, State } from "./types";

export class StarOverlaySDK extends Emitter {
    public state: State = "loading";
    public settings: Record<string, any> = {};
    public widgetToken: string | null;
    public widget: Partial<IWidget> = {};
    public preview: boolean;
    public apiUrl: string;
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

        // Resolve API and Media URLs
        // Falls back to localhost defaults for development if not provided
        // @ts-ignore
        this.apiUrl = urlParams.get('apiUrl') ?? import.meta.env.VITE_API_URL ?? "https://api.staroverlay.com";
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
            appEl.state = newState;
            appEl.setAttribute('state', newState);
        }
        this.emit('state:change', newState);
    }

    /**
     * Subscribe to events from a specific integration
     */
    public subscribe<T = any>(integrationId: string, eventId: string, callback?: (data: T) => void) {
        if (!integrationId) return false;

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

        try {
            // 1. Fetch initial configuration DIRECTLY from the backend SDK endpoint
            const configUrl = `${this.apiUrl.replace(/\/$/, '')}/sdk/widget-config?token=${encodeURIComponent(this.widgetToken)}`;
            const response = await fetch(configUrl);

            if (!response.ok) {
                throw new Error(`Failed to load widget config: ${response.status}`);
            }

            const payload = await response.json();

            if (payload.error) {
                throw new Error(payload.error);
            }

            const { widget, integrations } = payload;

            this.widget = widget;
            this.integrations = integrations || [];

            try {
                this.settings = typeof widget.settings === 'string'
                    ? JSON.parse(widget.settings)
                    : (widget.settings || {});
            } catch (e) {
                console.error("StarOverlay: Failed to parse widget settings", e);
                this.settings = {};
            }

            this.enabled = widget.enabled !== false;
            this.setState("ok");
            this.emit("ready", this);

            // 2. Initialize Event WebSocket
            this.initSocket();

        } catch (err: any) {
            console.error("StarOverlay: Initialization failed", err);
            this.error = err.message;
            this.setState("error");
            this.emit("error", err);
        }
    }

    private initSocket() {
        if (!this.widgetToken) return;

        // Use the same host as the API but with the websocket protocol
        // (Unless overridden via eventsUrl)
        const urlParams = new URL(window.location.href).searchParams;
        const eventsUrlStr = urlParams.get('eventsUrl');

        let wsUrl: string;

        if (eventsUrlStr) {
            wsUrl = eventsUrlStr.startsWith('ws')
                ? eventsUrlStr
                : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${eventsUrlStr}`;
        } else {
            // Derive WS URL from the API URL
            const url = new URL(this.apiUrl);
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${url.host}/events/widget`;
        }

        if (!wsUrl.includes('token=')) {
            wsUrl += (wsUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(this.widgetToken)}`;
        }

        console.log(`StarOverlay: Connecting to events at ${wsUrl}`);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("StarOverlay: Event session connected");
            // Resubscribe to existing topics on reconnection
            this.subscriptions.forEach(sub => {
                this.send("subscribe", sub);
            });
        };

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                if (payload.event === "integration:event") {
                    const { integrationId, eventId, event: eventData } = payload.data;
                    const topic = `${integrationId}.${eventId}`;
                    this.emit(`event:${topic}`, eventData);
                }

                if (payload.event === "widget:settings_update") {
                    this.settings = payload.data;
                    this.emit("update", this.settings);
                }

                if (payload.event === "widget:toggle") {
                    this.enabled = payload.data.enabled !== false;
                    this.emit("toggle", this.enabled);
                }

                // Generic event emission
                if (payload.event) {
                    this.emit(payload.event, payload.data);
                }
            } catch (e) {
                if (event.data === "pong") {
                    this.emit("pong");
                }
            }
        };

        socket.onclose = (event) => {
            console.log("StarOverlay: Event session disconnected", event.code);
            // Reconnect after 3s
            setTimeout(() => {
                if (this.state !== "error") this.initSocket();
            }, 3000);
        };

        socket.onerror = (err) => {
            console.error("StarOverlay: Socket error", err);
        };

        this.socket = socket;
    }
}
