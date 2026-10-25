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
        "/api/admin/users": req => {
            return auth.admin(req, async () => {
                if (req.method === "POST") {
                    const body = await req.json() as { name?: string; pass?: string; isAdmin?: boolean } | undefined;
                    if (!body?.name || !body?.pass) {
                        return Response.json({ message: "Naam en wachtwoord zijn verplicht" }, { status: 400 });
                    }
                    if (theDB.getUserByName(body.name)) {
                        return Response.json({ message: "Gebruiker bestaat al" }, { status: 400 });
                    }
                    const created = theDB.createUser(body.name, body.pass, !!body.isAdmin);
                    return Response.json({ id: created.id, name: created.name, isAdmin: created.isAdmin });
                }
                return Response.json(theDB.getUsers());
            })
        },
        "/api/admin/users/:id": req => {
            return auth.admin(req, async (adminUser) => {
                const id = Number(req.params.id);
                if (req.method === "PUT") {
                    const body = await req.json() as { name?: string; pass?: string; isAdmin?: boolean } | undefined;
                    if (!body?.name) return Response.json({ message: "Naam is verplicht" }, { status: 400 });
                    if (!theDB.updateUser(id, body)) return Response.json({ message: "Gebruiker niet gevonden" }, { status: 404 });
                    return Response.json({ success: true });
                }
                if (req.method === "DELETE") {
                    if (id === adminUser.id) {
                        return Response.json({ message: "Je kunt jezelf niet verwijderen" }, { status: 400 });
                    }
                    if (!theDB.deleteUser(id)) {
                        return Response.json({ message: "Gebruiker niet gevonden" }, { status: 404 });
                    }
                    return Response.json({ success: true });
                }
                return new Response(JSON.stringify(theDB.getUserById(id)));
            })
        },
        "/api/admin/kasten/:id": req => {
            return auth.admin(req, async () => {
                const body = await req.json() as { name?: string; description?: string } | undefined;
                if (!body?.name) return Response.json({ message: "Naam is verplicht" }, { status: 400 });
                if (!theDB.updateKast(Number(req.params.id), body.name, body.description)) {
                    return Response.json({ message: "Kast niet gevonden" }, { status: 404 });
                }
                return Response.json({ success: true });
            })
        },
        "/api/admin/items/:id": req => {
            return auth.admin(req, async () => {
                const body = await req.json() as { name?: string; description?: string; kast?: number } | undefined;
                if (!body?.name) return Response.json({ message: "Naam is verplicht" }, { status: 400 });
                if (!theDB.updateItem(Number(req.params.id), { name: body.name, description: body.description, kast: body.kast })) {
                    return Response.json({ message: "Item niet gevonden" }, { status: 404 });
                }
                return Response.json({ success: true });
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
                return Response.json(theDB.openLeningen().filter((v) => v.user == user.id));
            }, () => {
                return Response.json({ error: "Niet ingelogd" }, { status: 401 });
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

        "/api/items": req => {
            return auth.gate(req, () => {
                return Response.json(theDB.getItems());
            })
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
                const itemObj = theDB.getItemById(lening.item);
                const kastObj = itemObj ? theDB.getKastById(itemObj.kast) : undefined;
                sendMessageToDiscord("", {
                    title: "📦 Item geleend",
                    color: 0xff9900,
                    fields: [
                        { name: "Item", value: itemObj?.name ?? `#${lening.item}`, inline: true },
                        { name: "Kast", value: kastObj?.name ?? "-", inline: true },
                        { name: "Door", value: user.name, inline: true },
                        { name: "Reden", value: body.reason, inline: true },
                        { name: "Terug verwacht", value: body.prommisedReturnInfo, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                });
                return new Response(JSON.stringify(lening));
            })
        },
        "/api/leningen/terug/:id": req => {
            return auth.gate(req, (user) => {
                const id = Number(req.params.id);
                const lening = theDB.openLeningen().find((l) => l.id === id);
                if (!lening || (lening.user !== user.id && !user.isAdmin)) {
                    return Response.json({ message: "Lening niet gevonden" }, { status: 400 });
                }
                const kastObj = lening.itemData ? theDB.getKastById(lening.itemData.kast) : undefined;
                theDB.returnItem(id);
                sendMessageToDiscord("", {
                    title: "✅ Item teruggebracht",
                    color: 0x2ecc71,
                    fields: [
                        { name: "Item", value: lening.itemData?.name ?? `#${lening.item}`, inline: true },
                        { name: "Kast", value: kastObj?.name ?? "-", inline: true },
                        { name: "Teruggebracht door", value: user.name, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                });
                return Response.json({ success: true });
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