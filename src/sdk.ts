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
    public eventsUrl: string;
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

        const host = window.location.hostname;

        // Environment detection based on hostname
        const isLocal = host === 'localhost' ||
            host === '127.0.0.1' ||
            host.startsWith('192.168.') ||
            host.startsWith('10.') ||
            host.startsWith('172.');

        const isDev = host.endsWith('dev.staroverlay.com');

        // Dynamic Defaults based on environment
        let defaultApi;
        let defaultMedia;
        let defaultEvents;

        if (isLocal) {
            // @ts-ignore
            defaultApi = import.meta.env?.VITE_LOCAL_API_URL ?? "http://localhost:3000";
            // @ts-ignore
            defaultMedia = import.meta.env?.VITE_LOCAL_MEDIA_URL ?? "http://localhost:8787";
            // @ts-ignore
            defaultEvents = import.meta.env?.VITE_LOCAL_EVENTS_URL ?? "http://localhost:6500";
        } else if (isDev) {
            // @ts-ignore
            defaultApi = import.meta.env?.VITE_DEV_API_URL ?? "https://api-dev.staroverlay.com";
            // @ts-ignore
            defaultMedia = import.meta.env?.VITE_DEV_MEDIA_URL ?? "https://uploads-dev.staroverlay.com";
            // @ts-ignore
            defaultEvents = import.meta.env?.VITE_DEV_EVENTS_URL ?? "https://events-dev.staroverlay.com";
        } else {
            // @ts-ignore
            defaultApi = import.meta.env?.VITE_PROD_API_URL ?? "https://api.staroverlay.com";
            // @ts-ignore
            defaultMedia = import.meta.env?.VITE_PROD_MEDIA_URL ?? "https://uploads.staroverlay.com";
            // @ts-ignore
            defaultEvents = import.meta.env?.VITE_PROD_EVENTS_URL ?? "https://events.staroverlay.com";
        }

        this.apiUrl = urlParams.get('apiUrl') ?? defaultApi;
        this.uploadContentUrl = urlParams.get('mediaUrl') ?? defaultMedia;
        // Priority: param > inferred from apiUrl > defaultEvents
        this.eventsUrl = urlParams.get('eventsUrl') ?? (urlParams.has('apiUrl') ? this.apiUrl : defaultEvents);

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
            // Legacy SDK sent subscribe commands, now we just track it locally
            // since the events-server broadcasts all allowed topics.
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

        // Initialize socket immediately, config will be received on auth_ok
        this.initSocket();
    }

    private initSocket() {
        if (!this.widgetToken) return;

        let wsUrl: string;

        if (this.eventsUrl.startsWith('ws')) {
            wsUrl = this.eventsUrl;
        } else if (this.eventsUrl.startsWith('http')) {
            const url = new URL(this.eventsUrl);
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${url.host}/ws`;
        } else {
            wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${this.eventsUrl}`;
        }

        // We don't append token to the QS anymore, we'll send it via an "auth" message

        console.log(`StarOverlay: Connecting to events at ${wsUrl}`);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("StarOverlay: Event session connected");
            // Automatically auth
            socket.send(JSON.stringify({ type: "auth", token: this.widgetToken }));
        };

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                if (payload.type === "auth_ok") {
                    console.log("StarOverlay: Authentication successful");

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
                    return;
                }

                if (payload.type === "replay") {
                    this.emit("sys:events_replay", payload.events);
                    return;
                }

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
