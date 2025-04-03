import { Pokemon, PokemonBasic, PokemonData, PokemonListResponse } from "../types/pokemon";

const BASE_URL = "https://pokeapi.co/api/v2";
const TOTAL_POKEMON_COUNT = 1302; // Total number of Pokemon available
const CACHE_KEY = "pokemon-data-cache";

// Generic fetcher function for SWR
export const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${url}`);
    }
    return response.json();
};

// Get cached pokemon data from localStorage
export const getCachedPokemonData = (): PokemonData[] | null => {
    if (typeof window === 'undefined') return null; // Check if running on client

    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);

            // Check if cache is still valid (24 hours)
            const ONE_DAY = 24 * 60 * 60 * 1000;
            if (Date.now() - timestamp < ONE_DAY) {
                console.log('Using cached Pokemon data from localStorage');
                return data;
            } else {
                console.log('Cache expired, fetching fresh data');
                localStorage.removeItem(CACHE_KEY);
                return null;
            }
        }
    } catch (error) {
        console.warn('Error reading from cache:', error);
    }
    return null;
};

// Set cached pokemon data to localStorage
export const setCachedPokemonData = (data: PokemonData[]): void => {
    if (typeof window === 'undefined') return; // Check if running on client

    try {
        const cacheData = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        console.log('Pokemon data cached in localStorage');
    } catch (error) {
        console.warn('Error caching data:', error);
    }
};

// Function to fetch the list of all Pokemon
async function fetchPokemonList(limit = TOTAL_POKEMON_COUNT, offset = 0): Promise<PokemonListResponse> {
    const response = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
        throw new Error('Failed to fetch Pokemon list');
    }
    return await response.json();
}

// Function to fetch details for a single Pokemon
async function fetchPokemonDetails(idOrName: string | number): Promise<Pokemon> {
    const response = await fetch(`${BASE_URL}/pokemon/${idOrName}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch details for Pokemon: ${idOrName}`);
    }
    return await response.json();
}

// Function to fetch details for multiple Pokemon in batches
async function fetchMultiplePokemonDetails(pokemonBasics: PokemonBasic[]): Promise<PokemonData[]> {
    // Process in smaller batches to avoid rate limiting and improve reliability
    const batchSize = 20;
    const results: PokemonData[] = [];

    // Progress tracking for debugging/monitoring
    let processed = 0;
    const total = pokemonBasics.length;

    // Process Pokemon in small batches
    for (let i = 0; i < pokemonBasics.length; i += batchSize) {
        const batch = pokemonBasics.slice(i, i + batchSize);

        // Fetch details for current batch
        const promises = batch.map(pokemon => {
            const id = extractIdFromUrl(pokemon.url);
            return fetchPokemonDetails(id);
        });

        try {
            const pokemonDetails = await Promise.all(promises);

            // Process results
            const processedBatch = pokemonDetails.map(pokemon => ({
                id: pokemon.id,
                name: pokemon.name,
                types: pokemon.types.map(typeInfo => typeInfo.type.name),
                imageUrl: pokemon.sprites.other?.showdown?.front_default || pokemon.sprites.front_default
            }));

            results.push(...processedBatch);

            // Update progress
            processed += batch.length;
            console.log(`Processed ${processed}/${total} Pokemon (${Math.round(processed / total * 100)}%)`);

            // Optional: Add a small delay between batches to be respectful to the API
            if (i + batchSize < pokemonBasics.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.error(`Error processing batch ${i} to ${i + batchSize}:`, error);
            // Continue with next batch rather than failing completely
        }
    }

    return results;
}

// Helper function to extract Pokemon ID from URL
function extractIdFromUrl(url: string): number {
    const matches = url.match(/\/pokemon\/(\d+)\//);
    return matches ? parseInt(matches[1], 10) : 0;
}

// Main function for SWR - fetch all pokemon at once
export async function fetchAllPokemon(): Promise<PokemonData[]> {
    try {
        // Check cache first
        const cachedData = getCachedPokemonData();
        if (cachedData) {
            return cachedData;
        }

        console.log("Fetching all Pokemon data...");

        // Get all 1302 Pokemon in a single API call
        const response = await fetchPokemonList();
        console.log(`Got list of ${response.results.length} Pokemon`);

        // Now fetch details for all Pokemon
        const allPokemon = await fetchMultiplePokemonDetails(response.results);

        console.log(`Successfully processed all ${allPokemon.length} Pokemon`);

        // Cache the data for future use
        setCachedPokemonData(allPokemon);

        return allPokemon;
    } catch (error) {
        console.error("Error fetching all Pokemon:", error);
        throw error;
    }
} 