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
};