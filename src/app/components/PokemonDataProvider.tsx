import { PokemonContent } from "./PokemonContent";
import { PokemonData } from "../types/pokemon";

async function fetchPokemonData(): Promise<PokemonData[]> {
    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NODE_ENV === 'development'
                ? 'http://localhost:3000'
                : '';

        const response = await fetch(`${baseUrl}/api/pokemon`, {
            cache: 'force-cache',
            next: {
                revalidate: 60,
                tags: ['pokemon-data']
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch Pokemon data from API');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error prefetching Pokemon data:", error);
        return [];
    }
}

export async function PokemonDataProvider() {
    const pokemonData = await fetchPokemonData();

    return <PokemonContent initialPokemonData={pokemonData} forceLoading={true} />;
}