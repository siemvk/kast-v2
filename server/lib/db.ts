import { Database } from "bun:sqlite";
import { randomUUIDv7 } from "bun";
import { sendMessageToDiscord } from "./webhook";

export type user = {
    id: number;
    name: string;
    pass: string;
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
};

export type session = {
    user: number;
    cookie: string;
    bad: Date;
};

class db {
    private sqlite: Database;

    constructor(filename: string = "kast.sqlite") {
        this.sqlite = new Database(filename);
        this.init();
    }

    private init() {
        this.sqlite.run("PRAGMA journal_mode = WAL;");

        this.sqlite.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                pass TEXT NOT NULL,
                isAdmin INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sessions (
                cookie TEXT PRIMARY KEY,
                user INTEGER NOT NULL,
                bad INTEGER NOT NULL,
                FOREIGN KEY(user) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS kasten (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kast INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                FOREIGN KEY(kast) REFERENCES kasten(id)
            );
        `);

        // Seed default admin user siem if not exists
        const existingUser = this.getUserByName("siem");
        if (!existingUser) {
            this.sqlite.run(
                `INSERT INTO users (id, name, pass, isAdmin) VALUES (?, ?, ?, ?)`,
                [1234, "siem", Bun.password.hashSync("siem"), 1]
            );
        }

        // Seed default session if not exists
        const existingSession = this.sqlite.query(`SELECT cookie FROM sessions WHERE cookie = ?`).get("abc");
        if (!existingSession) {
            this.sqlite.run(
                `INSERT INTO sessions (cookie, user, bad) VALUES (?, ?, ?)`,
                ["abc", 1234, Date.now() + 7 * 24 * 60 * 60 * 1000]
            );
        }

        // Seed default kast if not exists
        const existingKast = this.sqlite.query(`SELECT id FROM kasten WHERE id = 0`).get();
        if (!existingKast) {
            this.sqlite.run(
                `INSERT INTO kasten (id, name, description) VALUES (?, ?, ?)`,
                [0, "None", "No kast."]
            );
        }
    }

    public getUserByName(Uname: string): user | undefined {
        const row = this.sqlite.query<any, [string]>(
            `SELECT id, name, pass, isAdmin FROM users WHERE name = ?`
        ).get(Uname);

        if (!row) return undefined;
        return {
            id: row.id,
            name: row.name,
            pass: row.pass,
            isAdmin: Boolean(row.isAdmin),
        };
    }

    public getUserById(Uid: number): user | undefined {
        const row = this.sqlite.query<any, [number]>(
            `SELECT id, name, pass, isAdmin FROM users WHERE id = ?`
        ).get(Uid);

        if (!row) return undefined;
        return {
            id: row.id,
            name: row.name,
            pass: row.pass,
            isAdmin: Boolean(row.isAdmin),
        };
    }

    public createSession(Uid: number): session | undefined {
        const user = this.getUserById(Uid);
        if (user == undefined) return undefined;

        const session: session = {
            user: Uid,
            cookie: randomUUIDv7(),
            bad: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

        this.sqlite.run(
            `INSERT INTO sessions (cookie, user, bad) VALUES (?, ?, ?)`,
            [session.cookie, session.user, session.bad.getTime()]
        );

        sendMessageToDiscord("", {
            title: "Session made",
            description: `user: ${user.name}`,
            timestamp: new Date().toISOString(),
        });

        return session;
    }

    public validateCookie(Ucookie: string): false | user {
        const row = this.sqlite.query<any, [string]>(
            `SELECT cookie, user, bad FROM sessions WHERE cookie = ?`
        ).get(Ucookie);

        if (!row || row.bad < Date.now()) return false;

        const user = this.getUserById(row.user);
        if (user == undefined) return false;

        return user;
    }

    public createUser(name: string, rawPassword: string, isAdmin: boolean = false): user {
        const hash = Bun.password.hashSync(rawPassword);
        const res = this.sqlite.run(
            `INSERT INTO users (name, pass, isAdmin) VALUES (?, ?, ?)`,
            [name, hash, isAdmin ? 1 : 0]
        );
        return {
            id: Number(res.lastInsertRowid),
            name,
            pass: hash,
            isAdmin,
        };
    }

    public getKasten(): kast[] {
        return this.sqlite.query<kast, []>(`SELECT id, name, description FROM kasten`).all();
    }

    public getKastById(id: number): kast | undefined {
        return this.sqlite.query<kast, [number]>(`SELECT id, name, description FROM kasten WHERE id = ?`).get(id) ?? undefined;
    }

    public createKast(name: string, description?: string): kast {
        const res = this.sqlite.run(
            `INSERT INTO kasten (name, description) VALUES (?, ?)`,
            [name, description ?? null]
        );
        return {
            id: Number(res.lastInsertRowid),
            name,
            description,
        };
    }
    public getKastItemsBasedOnKast(kastId: number) {
        const res = this.sqlite.query<item, [number]>(`SELECT id, kast, name, description FROM items WHERE kast = ?`).all(kastId);
        return res;
    }

    public getItems(kastId?: number): item[] {
        if (kastId !== undefined) {
            return this.sqlite.query<item, [number]>(`SELECT id, kast, name, description FROM items WHERE kast = ?`).all(kastId);
        }
        return this.sqlite.query<item, []>(`SELECT id, kast, name, description FROM items`).all();
    }

    public createItem(kastId: number, name: string, description?: string): item {
        const res = this.sqlite.run(
            `INSERT INTO items (kast, name, description) VALUES (?, ?, ?)`,
            [kastId, name, description ?? null]
        );
        return {
            id: Number(res.lastInsertRowid),
            kast: kastId,
            name,
            description,
        };
    }
}

export let theDB = new db();