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
            const user = theDB.validateCookie(
                req.cookies.get("kast-token") || "invalid"
            )
            if (user) {
                if (!user.isAdmin) return new Response("No.", { status: 500 })

                sendMessageToDiscord("john", {
                    color: 255,
                    title: "hi"
                })
                return new Response(JSON.stringify(theDB.getUserById(req.params.id as unknown as number)));
            } else {
                return new Response("No.", { status: 500 })
            }
        },

        // Check current authenticated user
        "/api/me": req => {
            const token = req.cookies.get("kast-token");
            if (!token) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
            const user = theDB.validateCookie(token);
            if (!user) return new Response(JSON.stringify({ error: "Ongeldige sessie" }), { status: 401 });
            return new Response(JSON.stringify({ id: user.id, name: user.name, isAdmin: user.isAdmin }));
        },

        // Logout route
        "/api/auth/logout": req => {
            req.cookies.set("kast-token", "", { maxAge: 0, path: "/" });
            return new Response(JSON.stringify({ success: true }));
        },

        "/api/kasten/list": req => {
            const user = theDB.validateCookie(
                req.cookies.get("kast-token") || "invalid"
            )
            if (user) {
                return new Response(JSON.stringify(theDB.getKasten()))
            } else {
                return new Response("No.", { status: 500 })
            }
        },
        "/api/kasten/content/:id": req => {
            const user = theDB.validateCookie(
                req.cookies.get("kast-token") || "invalid"
            )
            if (user) {
                return new Response(JSON.stringify(theDB.getKastItemsBasedOnKast(req.params.id as unknown as number)))
            } else {
                return new Response("No.", { status: 500 })
            }
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
                    req.cookies.set("kast-token", resp?.cookie)
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