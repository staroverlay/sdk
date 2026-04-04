export interface Emote {
    code: string;
    id: string;
    url: {
        low: string;
        mid?: string;
        high?: string;
    };
}

export type MessageTokenEmote = {
    type: "emote";
    emote: Emote;
};

export type MessageTokenText = {
    type: "text";
    text: string;
};

export type MessageToken = MessageTokenEmote | MessageTokenText;

export type TwitchMessageRawEmotes = { [emoteid: string]: string[] } | undefined;
