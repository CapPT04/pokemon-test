import { PokemonContent } from "./PokemonContent";
import { PokemonData } from "../types/pokemon";

async function fetchPokemonData(): Promise<PokemonData[]> {
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
        console.log('Skipping data fetch during build phase');
        return [];
    }

    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NODE_ENV === 'development'
                ? 'http://localhost:3000'
                : '';

        const url = new URL('/api/pokemon', baseUrl || 'http://localhost:3000');

        console.log(`Fetching Pokemon data from: ${url.toString()}`);

        const response = await fetch(url.toString(), {
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