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
    extendCookie(Ucookie: string) {
        const user = theDB.validateCookie(Ucookie);

        if (!user) throw new Error("Invalid.");

        theDB.createSession(user.id)


    }
}