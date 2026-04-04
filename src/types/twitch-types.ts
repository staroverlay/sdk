export type TwitchEventType =
    | "channel.channel_points_custom_reward_redemption.add"
    | "channel.channel_points_custom_reward_redemption.update"
    | "channel.follow"
    | "channel.subscribe"
    | "channel.subscription.message"
    | "channel.subscription.gift"
    | "channel.cheer"
    | "channel.raid"
    | "channel.ban"
    | "channel.unban"
    | "stream.online"
    | "stream.offline";

export interface TwitchRewardRedemptionEvent {
    id: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    user_id: string;
    user_login: string;
    user_name: string;
    user_input: string;
    status: "unfulfilled" | "fulfilled" | "canceled";
    reward: {
        id: string;
        title: string;
        cost: number;
        prompt: string;
    };
    redeemed_at: string;
}

export interface TwitchFollowEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    followed_at: string;
}

export interface TwitchSubscribeEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    tier: string;
    is_gift: boolean;
}

export interface TwitchSubscriptionMessageEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    tier: string;
    message: {
        text: string;
        emotes: { begin: number; end: number; id: string }[];
    };
    cumulative_months: number;
    streak_months: number | null;
    duration_months: number;
}

export interface TwitchSubscriptionGiftEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    total: number;
    tier: string;
    cumulative_total: number | null;
    is_anonymous: boolean;
}

export interface TwitchCheerEvent {
    is_anonymous: boolean;
    user_id: string | null;
    user_login: string | null;
    user_name: string | null;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    message: string;
    bits: number;
}

export interface TwitchRaidEvent {
    from_broadcaster_user_id: string;
    from_broadcaster_user_login: string;
    from_broadcaster_user_name: string;
    to_broadcaster_user_id: string;
    to_broadcaster_user_login: string;
    to_broadcaster_user_name: string;
    viewers: number;
}

export interface TwitchBanEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    moderator_user_id: string;
    moderator_user_login: string;
    moderator_user_name: string;
    reason: string;
    banned_at: string;
    ends_at: string | null;
    is_permanent: boolean;
}

export interface TwitchUnbanEvent {
    user_id: string;
    user_login: string;
    user_name: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    moderator_user_id: string;
    moderator_user_login: string;
    moderator_user_name: string;
}

export interface TwitchStreamOnlineEvent {
    id: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    type: "live" | "playlist" | "watch_party" | "premiere" | "rerun";
    started_at: string;
}

export interface TwitchStreamOfflineEvent {
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
}
