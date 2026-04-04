export * from "./twitch-types";
export * from "./chat-types";

export interface IIntegration {
    id: string;
    type: "twitch";
    username: string;
    avatarURL: string;
}

export interface IWidget {
    id: string;
    app_id: string;
    display_name: string;
    settings: Record<string, any>;
    integrations: IIntegration[];
    enabled: boolean;
    token: string;
}

export type State = "loading" | "ok" | "error" | "disabled";