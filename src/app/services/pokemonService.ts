import { Pokemon, PokemonBasic, PokemonData, PokemonListResponse } from "../types/pokemon";

const BASE_URL = "https://pokeapi.co/api/v2";

export async function fetchPokemonList(limit = 24, offset = 0): Promise<PokemonListResponse> {
    const response = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
        throw new Error('Failed to fetch Pokemon list');
    }
    return await response.json();
}

export async function fetchPokemonDetails(idOrName: string | number): Promise<Pokemon> {
    const response = await fetch(`${BASE_URL}/pokemon/${idOrName}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch details for Pokemon: ${idOrName}`);
    }
    return await response.json();
}

export async function fetchMultiplePokemonDetails(pokemonBasics: PokemonBasic[]): Promise<PokemonData[]> {
    const promises = pokemonBasics.map(pokemon => {
        const id = extractIdFromUrl(pokemon.url);
        return fetchPokemonDetails(id);
    });


    const pokemonDetails = await Promise.all(promises);


    const processedPokemon = pokemonDetails.map(pokemon => ({
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types.map(typeInfo => typeInfo.type.name),
        imageUrl: pokemon.sprites.other?.showdown?.front_default || pokemon.sprites.front_default
    }));

    console.log("processedPokemon", processedPokemon);

    return processedPokemon;

}

// New function to fetch all Pokemon in batches
export async function fetchAllPokemon(): Promise<PokemonData[]> {
    try {
        // First, get the total count
        const initialResponse = await fetchPokemonList(1, 0);
        const totalCount = initialResponse.count;

        // Now fetch in batches of 100 to be efficient but not overload the API
        const batchSize = 100;
        const batchCount = Math.ceil(totalCount / batchSize);

        let allPokemon: PokemonData[] = [];

        // Use Promise.all to fetch batches in parallel
        const batchPromises = [];

        for (let i = 0; i < batchCount; i++) {
            const offset = i * batchSize;
            batchPromises.push(
                fetchPokemonList(batchSize, offset)
                    .then(response => fetchMultiplePokemonDetails(response.results))
            );
        }

        const batchResults = await Promise.all(batchPromises);

        // Combine all results
        allPokemon = batchResults.flat();

        return allPokemon;
    } catch (error) {
        console.error("Error fetching all Pokemon:", error);
        throw error;
    }
}

function extractIdFromUrl(url: string): number {
    const matches = url.match(/\/pokemon\/(\d+)\//);
    return matches ? parseInt(matches[1], 10) : 0;
} 