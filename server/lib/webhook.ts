export interface DiscordEmbedFooter {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
}

export interface DiscordEmbedImage {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

export interface DiscordEmbedThumbnail {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

export interface DiscordEmbedVideo {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

export interface DiscordEmbedProvider {
    name?: string;
    url?: string;
}

export interface DiscordEmbedAuthor {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
}

export interface DiscordEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}
const a: Record<string, number> = {
    "a": 1
}
const b: Array<string> = [
    "a"
]
const c: string[] | undefined = [
    "a"
]


export type DiscordEmbed = {
    title?: string;
    type?: "rich" | "image" | "video" | "gifv" | "article" | "link";
    description?: string;
    url?: string;
    timestamp?: string; // Moet een ISO8601 timestamp zijn
    color?: number; // RGB-kleur omgezet naar een integer (bijv. 16711680 voor rood)
    footer?: DiscordEmbedFooter;
    image?: DiscordEmbedImage;
    thumbnail?: DiscordEmbedThumbnail;
    video?: DiscordEmbedVideo;
    provider?: DiscordEmbedProvider;
    author?: DiscordEmbedAuthor;
    fields?: DiscordEmbedField[];
}
export async function sendMessageToDiscord(content: string, embed?: DiscordEmbed) {
    const webhookUrl = process.env.DISCORD;
    if (!webhookUrl) {
        console.warn("No webhook url configured");
        return { success: false, message: "No webhook url configured" };
    }
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content,
            ...(embed ? { embeds: [embed] } : {}),
        }),
    });
    if (!response.ok) {
        console.error("Failed to send webhook", await response.text());
    }
}