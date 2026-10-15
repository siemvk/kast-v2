import { sleep, type BunRequest } from "bun";
import type { user } from "../../shared/types";
import { theDB } from "./db"

export const auth = {
    async login(Uname: string, Upass: string) {
        const user = theDB.getUserByName(Uname);
        if (user == undefined) {
            throw new Error("No.");
        }

        const isMatch = await Bun.password.verify(Upass, user.pass);

        if (!isMatch) {
            throw new Error("No.");
        }

        return theDB.createSession(user.id)
    },
    async gate(
        Ureq: BunRequest,
        oke: ((arg0: user) => (Response | Promise<Response>)),
        notOke?: () => Response | Promise<Response>
    ): Promise<Response> {
        const user = theDB.validateCookie(
            Ureq.cookies.get("kast-token") || "invalid"
        )
        if (user) {
            return await oke(user)
        } else {
            if (notOke) {
                return await notOke()
            } else {
                return new Response("No.", { status: 500 })
            }
        }
    },
    async admin(
        Ureq: BunRequest,
        oke: ((arg0: user) => (Response | Promise<Response>)),
        notOke?: () => Response | Promise<Response>
    ): Promise<Response> {
        const user = theDB.validateCookie(
            Ureq.cookies.get("kast-token") || "invalid"
        )
        if (user && user.isAdmin) {
            return await oke(user)
        } else {
            if (notOke) {
                return await notOke()
            } else {
                return new Response("No.", { status: 500 })
            }
        }
    }

}