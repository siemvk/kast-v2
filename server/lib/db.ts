import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUIDv7 } from "bun";
import { sendMessageToDiscord } from "./webhook";

export type user = {
    id: number;
    name: string;
    pass?: string;
    isAdmin: boolean;
};

export type kast = {
    id: number;
    name: string;
    description?: string;
};

export type item = {
    id?: number;
    kast: number;
    name: string;
    description?: string;
    beschikbaar: boolean;
};

export type session = {
    user: number;
    cookie: string;
    bad: Date;
};

export type database = {
    sessions: session[];
    kasten: kast[];
    items: item[];
    users: user[];
    leningen: lening[];
};

export type lening = {
    item: number;
    user: number;
    start: Date;
    reason: string;
    prommisedReturnInfo: string;
    end?: Date;
    id: number;
}

const defaultData: database = {
    sessions: [],
    kasten: [
        {
            id: 0,
            name: "Voorbeeldkast",
            description: "Dit is een voorbeeldkast.",
        }
    ],
    items: [
        {
            id: 0,
            kast: 0,
            name: "Voorbeelditem",
            description: "Dit is een voorbeelditem.",
            beschikbaar: true,
        },
        {
            id: 1,
            kast: 0,
            name: "Voorbeelditem 2",
            description: "Dit is een voorbeelditem.",
            beschikbaar: false,
        }
    ],
    users: [
        {
            name: "siem",
            id: 0,
            isAdmin: true,
            pass: Bun.password.hashSync("siem"),
        }
    ],
    leningen: []
};

class db {
    private data: database;
    private path: string;

    constructor(filename: string = "kast.json") {
        this.path = filename;
        if (existsSync(this.path)) {
            try {
                const raw = readFileSync(this.path, "utf-8");
                this.data = JSON.parse(raw);
            } catch {
                this.data = structuredClone(defaultData);
                this.writeOut();
            }
        } else {
            this.data = structuredClone(defaultData);
            this.writeOut();
        }

        if (!Array.isArray(this.data.sessions)) this.data.sessions = [];
        if (!Array.isArray(this.data.kasten)) this.data.kasten = [];
        if (!Array.isArray(this.data.items)) this.data.items = [];
        if (!Array.isArray(this.data.users)) this.data.users = [];
        if (!Array.isArray(this.data.leningen)) this.data.leningen = [];
    }

    public getUserByName(Uname: string): user | undefined {
        const user = this.data.users.find((u) => u.name === Uname);
        if (!user) return undefined;
        return {
            id: user.id,
            name: user.name,
            isAdmin: user.isAdmin,
            pass: "No.",
        };
    }

    public getUserByNameUNSAFE(Uname: string): user | undefined {
        return this.data.users.find((u) => u.name === Uname);
    }

    public getUserById(Uid: number): user | undefined {
        const user = this.data.users.find((u) => u.id === Number(Uid));
        if (!user) return undefined;
        return {
            id: user.id,
            name: user.name,
            isAdmin: user.isAdmin,
            pass: "No.",
        };
    }

    public getUserByIdUNSAFE(Uid: number): user | undefined {
        const user = this.data.users.find((u) => u.id === Number(Uid));
        if (!user) return undefined;
        return { ...user };
    }

    public createSession(Uid: number): session | undefined {
        const user = this.getUserById(Uid);
        if (user == undefined) return undefined;

        const session: session = {
            user: Number(Uid),
            cookie: randomUUIDv7(),
            bad: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

        this.data.sessions.push(session);

        sendMessageToDiscord("", {
            title: "Session made",
            description: `user: ${user.name}`,
            timestamp: new Date().toISOString(),
        });
        this.writeOut();

        return session;
    }

    public validateCookie(Ucookie: string): false | user {
        const session = this.data.sessions.find((s) => s.cookie === Ucookie);
        if (!session || new Date(session.bad).getTime() < Date.now()) return false;

        const user = this.getUserById(session.user);
        if (user == undefined) return false;

        return user;
    }

    public createUser(name: string, rawPassword: string, isAdmin: boolean = false): user {
        const hash = Bun.password.hashSync(rawPassword);
        const nextId = this.data.users.length > 0
            ? Math.max(...this.data.users.map((u) => u.id)) + 1
            : 0;
        const user: user = {
            id: nextId,
            name,
            pass: hash,
            isAdmin,
        };
        this.data.users.push(user);
        this.writeOut();
        return user;
    }

    public getKasten(): kast[] {
        return this.data.kasten;
    }

    public getKastById(id: number): kast | undefined {
        const kast = this.data.kasten.find((k) => k.id === Number(id));
        return kast;
    }

    public createKast(name: string, description?: string): kast {
        const nextId = this.newId(this.data.kasten)
        const kast: kast = {
            id: nextId,
            name,
            description,
        };
        this.data.kasten.push(kast);
        this.writeOut();
        return kast;
    }

    public getKastItemsBasedOnKast(kastId: number): item[] {
        const items = this.data.items.filter((item) => item.kast === Number(kastId));
        return items;
    }

    public getItems(kastId?: number): item[] {
        if (kastId !== undefined) {
            return this.getKastItemsBasedOnKast(kastId);
        }
        return this.data.items;
    }

    public createItem(kastId: number, name: string, description?: string, beschikbaar: boolean = true): item {
        const nextId = this.newId(this.data.items)
        const item: item = {
            id: nextId,
            kast: Number(kastId),
            name,
            description,
            beschikbaar,
        };
        this.data.items.push(item);
        this.writeOut();
        return item;
    }

    public leenItem(itemId: number, userId: number, Ureason: string, Ureturn: string): lening | undefined {
        const item = this.data.items.find((i) => i.id === Number(itemId));
        if (!item || !item.beschikbaar) return undefined;

        const nextId = this.newId(this.data.leningen)

        const lening: lening = {
            item: Number(itemId),
            user: Number(userId),
            start: new Date(),
            id: nextId,
            prommisedReturnInfo: Ureturn,
            reason: Ureason

        };

        item.beschikbaar = false;
        this.data.leningen.push(lening);
        this.writeOut();
        return lening;
    }

    public returnItem(leningId: number): boolean {
        const lening = this.data.leningen.find((l) => l.id === Number(leningId));
        if (!lening || lening.end) return false;

        const item = this.data.items.find((i) => i.id === Number(lening.item));
        if (!item) return false;

        item.beschikbaar = true;
        lening.end = new Date();
        this.writeOut();
        return true;
    }
    public openLeningen() {
        return this.data.leningen.filter((v) => v.end !== undefined)
    }

    public allLeningen() {
        return this.data.leningen
    }

    public removeOldLeningen() {
        const now = new Date();
        const tweeMaandenTerug = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
        this.data.leningen = this.data.leningen.filter((lening) => {
            if (lening.end && lening.end < tweeMaandenTerug) {
                return false; // Remove leningen older than 2 months
            }
            return true; // Keep leningen that are not older than 2 months
        });
        this.writeOut();
    }

    private writeOut() {
        writeFileSync(this.path, JSON.stringify(this.data, null, 2), "utf-8");
    }

    private newId(list: any[]): number {
        const nextId = list.length > 0
            ? Math.max(...list.map((l) => l.id)) + 1
            : 0;
        return nextId;
    }
    public deleteSession(cookie: string): void {
        this.data.sessions = this.data.sessions.filter((s) => s.cookie !== cookie);
        this.writeOut();
    }
    public extendSession(cookie: string): void {
        const session = this.data.sessions.find((s) => s.cookie === cookie);
        if (session) {
            session.bad = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
        this.writeOut();
    }
}

export let theDB = new db();