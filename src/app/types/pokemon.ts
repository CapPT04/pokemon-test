// Types for Pokemon API responses

export interface PokemonListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: PokemonBasic[];
}

export interface PokemonBasic {
    name: string;
    url: string;
}

export interface Pokemon {
    id: number;
    name: string;
    types: PokemonType[];
    sprites: {
        front_default: string;
        other: {
            showdown: {
                front_default: string;
            };
        };
    };
}

export interface PokemonType {
    slot: number;
    type: {
        name: string;
        url: string;
    };
}

// Processed Pokemon for our UI
export interface PokemonData {
    id: number | string;
    name: string;
    types: string[];
    imageUrl: string;
    matchingTypes?: string[];
    slots?: number[] | Array<{ type: string; slot: number }>;
    url?: string;
} 