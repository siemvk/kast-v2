import { sleep } from "bun";
import type { loginRequest } from "../shared/types";
import { auth } from "./lib/auth";
import { theDB } from "./lib/db";
import { sendMessageToDiscord } from "./lib/webhook";

const server = Bun.serve({
    // `routes` requires Bun v1.2.3+
    routes: {
        // Static routes
        "/api/status": new Response("OK"),

        // Dynamic routes
        "/api/admin/users/:id": req => {
            return auth.admin(req, () => {
                return new Response(JSON.stringify(theDB.getUserById(req.params.id as unknown as number)));
            })
        },
        "/api/admin/leningen": req => {
            return auth.admin(req, () => {
                return new Response(JSON.stringify(theDB.allLeningen()));
            })
        },
        "/api/admin/leningen/open": req => {
            return auth.admin(req, () => {
                return new Response(JSON.stringify(theDB.openLeningen()));
            })
        },
        "/api/admin/leningen/purge": req => {
            return auth.admin(req, () => {
                return new Response(JSON.stringify(theDB.removeOldLeningen()));
            })
        },
        "/api/leningen": req => {
            return auth.gate(req, (user) => {
                return new Response(JSON.stringify(theDB.openLeningen().filter((v) => v.user == user.id)));
            })
        },

        "/api/me": req => {
            return auth.gate(req, (user) => {
                theDB.extendSession(req.cookies.get("kast-token") || "")
                return new Response(JSON.stringify({ id: user.id, name: user.name, isAdmin: user.isAdmin }));
            }, () => {
                return new Response(JSON.stringify({ error: "Ongeldige sessie" }), { status: 401 });
            })
        },

        "/api/auth/logout": req => {
            theDB.deleteSession(req.cookies.get("kast-token") || "")
            req.cookies.set("kast-token", "", { maxAge: 0, path: "/" });
            return new Response(JSON.stringify({ success: true }));
        },

        "/api/kasten/list": req => {
            return auth.gate(req, () => {
                return new Response(JSON.stringify(theDB.getKasten()))
            })
        },
        "/api/kasten/:id/items": async req => {
            return auth.gate(req, () => {
                return new Response(JSON.stringify(theDB.getKastItemsBasedOnKast(req.params.id as unknown as number)))
            })
        },
        "/api/leningen/leen/:itemId": async req => {
            return auth.gate(req, async (user) => {
                const body = await req.json() as { reason: string, prommisedReturnInfo: string } | undefined;
                if (!body) {
                    return new Response(JSON.stringify({ error: "Geen body gegeven" }), { status: 400 });
                }
                const lening = theDB.leenItem(req.params.itemId as unknown as number, user.id, body.reason, body.prommisedReturnInfo);
                if (!lening) {
                    return new Response(JSON.stringify({ error: "Item niet beschikbaar" }), { status: 400 });
                }
                sendMessageToDiscord(`Item ${lening.item} is geleend door ${user.name} voor reden: ${body.reason}`);
                return new Response(JSON.stringify(lening));
            })
        },

        "/api/auth": async req => {
            try {
                const body: loginRequest | undefined = await req.json() as loginRequest | undefined;
                let resp;
                if (body == undefined) {
                    throw new Error("Geen body gegeven");
                } else {
                    resp = await auth.login(body.name, body.pass)
                    if (resp == undefined) throw new Error("Not Found");
                    // req.cookies.set("kast-token", resp?.cookie)
                    req.cookies.set("kast-token", resp?.cookie, {
                        httpOnly: true,
                        sameSite: "lax",
                        path: "/",
                        maxAge: 7 * 24 * 60 * 60,
                    });
                }


                return new Response(JSON.stringify({ ...resp, cookie: "Hidden" }))
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error?.message || "Fout bij inloggen" }), { status: 401 })
            }
        },
    },


    fetch(req) {
        return new Response("Not Found", { status: 404 });
    },
});

console.log(`Server running at ${server.url}`);