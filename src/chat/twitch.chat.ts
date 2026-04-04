import { IIntegration, MessageToken, TwitchMessageRawEmotes, Emote } from "../types";
import { EmoteFetcher } from "./emote-fetcher";
import { IChatParser, EmoteProviderOptions } from "./chat-parser";

interface APIResponse {
    emotes: Emote[];
}

export class TwitchChatParser implements IChatParser {
    public fetcher: EmoteFetcher;
    private static readonly baseURL: string = "https://open.staroverlay.com/twitch/";

    constructor(public integration: IIntegration) {
        this.fetcher = new EmoteFetcher();
    }

    async fetchEmotes(options?: EmoteProviderOptions): Promise<void> {
        let providers: string[] = [];
        if (options?.ffz !== false) providers.push("ffz");
        if (options?.bttv !== false) providers.push("bttv");
        if (options?.seventv !== false) providers.push("7tv");
        if (options?.channel !== false) providers.push("twitch");

        const username = this.integration.username;
        if (!username) throw new Error("Twitch integration has no username");

        let url = `${TwitchChatParser.baseURL}emotes?username=${username}`;
        if (providers.length > 0) {
            url += "&providers=" + providers.join(",");
        }

        const req = await fetch(url);
        const { emotes } = await req.json() as APIResponse;

        for (const emote of emotes) {
            this.fetcher.addEmote(emote);
        }
    }

    parseMessage(message: string, rawEmotesData?: TwitchMessageRawEmotes): MessageToken[] {
        const ranges: { start: number, end: number, emoteId: string }[] = [];

        for (const [emoteId, arr] of Object.entries(rawEmotesData || {})) {
            for (const range of arr) {
                const [start, end] = range.split("-").map(Number);
                ranges.push({ start, end, emoteId });
            }
        }

        ranges.sort((a, b) => a.start - b.start);

        const tokens: MessageToken[] = [];
        let cursor = 0;

        for (const r of ranges) {
            if (r.start > cursor) {
                const textChunk = message.substring(cursor, r.start);
                tokens.push(...this.parseTextChunk(textChunk));
            }

            const code = message.substring(r.start, r.end + 1);
            const emote = this.parseTwitchEmote(code, r.emoteId);
            tokens.push({ type: "emote", emote });
            cursor = r.end + 1;
        }

        if (cursor < message.length) {
            const textChunk = message.substring(cursor);
            tokens.push(...this.parseTextChunk(textChunk));
        }

        return tokens;
    }

    private parseTwitchEmote(code: string, id: string): Emote {
        const url = "https://static-cdn.jtvnw.net/emoticons/v2/" + id + "/default/dark/";

        return {
            code,
            id,
            url: {
                low: url + "1.0",
                mid: url + "2.0",
                high: url + "3.0",
            }
        };
    }

    private parseTextChunk(textChunk: string): MessageToken[] {
        const tokens: MessageToken[] = [];
        const words = textChunk.split(/(\s+)/);

        for (const part of words) {
            if (part === "") continue;

            const emote = this.fetcher.getEmote(part);
            if (emote) {
                tokens.push({
                    type: "emote",
                    emote
                });
            } else {
                tokens.push({
                    type: "text",
                    text: part
                });
            }
        }

        return tokens;
    }
}
