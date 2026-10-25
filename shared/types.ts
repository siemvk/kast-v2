export type loginRequest = {
    name: string;
    pass: string;
};

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
    kastData?: kast;
};

export type lening = {
    item: number;
    user: number;
    start: Date | string;
    reason: string;
    prommisedReturnInfo: string;
    end?: Date | string;
    id: number;
    itemData?: item;
    userData?: user;
};