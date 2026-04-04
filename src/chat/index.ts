import { IIntegration } from "../types";
import { IChatParser } from "./chat-parser";
import { TwitchChatParser } from "./twitch.chat";

export * from "./chat-parser";
export * from "./emote-fetcher";
export * from "./twitch.chat";

export function createChatParser(integration: IIntegration): IChatParser {
    switch (integration.type) {
        case "twitch":
            return new TwitchChatParser(integration);
        default:
            throw new Error(`Chat parser for provider ${integration.type} is not implemented.`);
    }
}
