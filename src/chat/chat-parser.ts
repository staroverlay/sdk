import { IIntegration, MessageToken } from "../types";
import { EmoteFetcher } from "./emote-fetcher";

export interface EmoteProviderOptions {
    channel?: boolean;
    ffz?: boolean;
    bttv?: boolean;
    seventv?: boolean;
}

export interface IChatParser {
    integration: IIntegration;
    fetcher: EmoteFetcher;

    fetchEmotes(options?: EmoteProviderOptions): Promise<void>;
    parseMessage(message: string, rawEmotesData?: any): MessageToken[];
}
