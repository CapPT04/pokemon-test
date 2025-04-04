import { Pokemon, PokemonBasic, PokemonData, PokemonListResponse } from "../types/pokemon";

const BASE_URL = "https://pokeapi.co/api/v2";
const TOTAL_POKEMON_COUNT = 1302;

// Cache configuration - will be only used in development since server resets
let cachedPokemonData: PokemonData[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour cache

async function fetchPokemonList(limit = TOTAL_POKEMON_COUNT, offset = 0): Promise<PokemonListResponse> {
    try {
        console.log('Fetching Pokemon list...');
        const response = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`, {
            next: {
                revalidate: 3600 // Cache for 1 hour in Next.js cache
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch Pokemon list');
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching Pokemon list:", error);
        return { count: 0, next: null, previous: null, results: [] };
    }
}

async function fetchPokemonDetails(idOrName: string | number): Promise<Pokemon> {
    try {
        const response = await fetch(`${BASE_URL}/pokemon/${idOrName}`, {
            next: {
                revalidate: 3600 // Cache for 1 hour in Next.js cache
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch details for Pokemon: ${idOrName}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching details for Pokemon ${idOrName}:`, error);

        return {
            id: typeof idOrName === 'number' ? idOrName : 0,
            name: typeof idOrName === 'string' ? idOrName : 'unknown',
            types: [],
            sprites: {
                front_default: '',
                other: {
                    showdown: {
                        front_default: ''
                    }
                }
            }
        };
    }
}

function extractIdFromUrl(url: string): number {
    const matches = url.match(/\/pokemon\/(\d+)\//);
    return matches ? parseInt(matches[1], 10) : 0;
}

async function fetchMultiplePokemonDetails(pokemonBasics: PokemonBasic[]): Promise<PokemonData[]> {
    if (pokemonBasics.length === 0) {
        return [];
    }

    console.log(`Fetching details for all ${pokemonBasics.length} Pokemon at once...`);

    const promises = pokemonBasics.map(pokemon => {
        const id = extractIdFromUrl(pokemon.url);
        return fetchPokemonDetails(id);
    });

    try {
        const pokemonDetails = await Promise.all(promises);

        const results = pokemonDetails.map(pokemon => ({
            id: pokemon.id,
            name: pokemon.name,
            types: pokemon.types.map(typeInfo => typeInfo.type.name),
            imageUrl: pokemon.sprites.other?.showdown?.front_default || pokemon.sprites.front_default
        }));

        console.log(`Successfully processed all ${results.length} Pokemon (100%)`);
        return results;
    } catch (error) {
        console.error(`Error processing Pokemon details:`, error);
        return [];
    }
}

export async function getAllPokemon(): Promise<PokemonData[]> {
    // During build time, return empty array to prevent connection errors
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
        console.log('Skipping Pokemon data fetch during build phase');
        return [];
    }

    // Check if we have valid cached data in memory (for development)
    const now = Date.now();
    if (cachedPokemonData && (now - lastFetchTime < CACHE_TTL)) {
        console.log('Using in-memory cached Pokemon data');
        return cachedPokemonData;
    }

    console.log('Fetching fresh Pokemon data from PokeAPI...');

    try {
        // Use fetch with cache: 'force-cache' to ensure Next.js caches this data
        const cacheKey = `pokemon-data-${new Date().toISOString().split('T')[0]}`;

        // Try to get from cache first
        try {
            const cachedResponse = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=1&offset=0&cache=${cacheKey}`, {
                next: { tags: ['pokemon-data'] }
            });

            // If we have a valid cache tag, check our memory cache
            if (cachedResponse.ok && cachedPokemonData) {
                console.log('Using cached Pokemon data via cache tag');
                return cachedPokemonData;
            }
        } catch {
            // Ignore cache check errors
        }

        const response = await fetchPokemonList();
        const allPokemon = await fetchMultiplePokemonDetails(response.results);

        // Update cache
        cachedPokemonData = allPokemon;
        lastFetchTime = now;

        console.log(`Fetched and cached ${allPokemon.length} Pokemon`);
        return allPokemon;
    } catch (error) {
        console.error("Critical error fetching Pokemon data:", error);
        return [];
    }
} 