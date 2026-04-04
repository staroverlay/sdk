import { Emote } from "../types";

export class EmoteFetcher {
    private readonly emotes: Set<Emote>;
    private readonly emotesMap: Map<string, Emote>;

    constructor() {
        this.emotes = new Set();
        this.emotesMap = new Map();
    }

    addEmote(emote: Emote) {
        this.emotes.add(emote);
        this.emotesMap.set(emote.code, emote);
    }

    getEmotes() {
        return this.emotes;
    }

    getEmote(code: string) {
        return this.emotesMap.get(code);
    }

    extractEmotes(message: string) {
        const detected: Emote[] = [];

        const parts = message.split(" ");
        for (const part of parts) {
            const emoteCandidate = this.getEmote(part);
            if (emoteCandidate) detected.push(emoteCandidate);
        }

        return detected;
    }
}
