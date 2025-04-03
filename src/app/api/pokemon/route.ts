import { NextResponse } from 'next/server';
import { Pokemon, PokemonBasic, PokemonData, PokemonListResponse } from "@/app/types/pokemon";

const BASE_URL = "https://pokeapi.co/api/v2";
const TOTAL_POKEMON_COUNT = 1302;

let cachedPokemonData: PokemonData[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000;

async function fetchPokemonList(limit = TOTAL_POKEMON_COUNT, offset = 0): Promise<PokemonListResponse> {
    try {
        const response = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`, {
            next: { revalidate: 86400 }
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
            next: { revalidate: 86400 }
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

    const batchSize = 20;
    const results: PokemonData[] = [];

    let processed = 0;
    const total = pokemonBasics.length;

    for (let i = 0; i < pokemonBasics.length; i += batchSize) {
        const batch = pokemonBasics.slice(i, i + batchSize);

        const promises = batch.map(pokemon => {
            const id = extractIdFromUrl(pokemon.url);
            return fetchPokemonDetails(id);
        });

        try {
            const pokemonDetails = await Promise.all(promises);

            const processedBatch = pokemonDetails.map(pokemon => ({
                id: pokemon.id,
                name: pokemon.name,
                types: pokemon.types.map(typeInfo => typeInfo.type.name),
                imageUrl: pokemon.sprites.other?.showdown?.front_default || pokemon.sprites.front_default
            }));

            results.push(...processedBatch);

            processed += batch.length;
            console.log(`Processed ${processed}/${total} Pokemon (${Math.round(processed / total * 100)}%)`);

            if (i + batchSize < pokemonBasics.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.error(`Error processing batch ${i} to ${i + batchSize}:`, error);
        }
    }

    return results;
}

export async function GET(request: Request) {
    try {
        const now = Date.now();
        const headers = new Headers(request.headers);
        const isClientRequest = headers.get('x-fetch-source') === 'client';

        if (cachedPokemonData && (now - lastFetchTime < CACHE_TTL)) {
            console.log('Using in-memory cached Pokemon data');

            if (isClientRequest) {
                return NextResponse.json(cachedPokemonData, {
                    headers: {
                        'Cache-Control': 'public, max-age=60, stale-while-revalidate=3600',
                        'X-Pokemon-Count': cachedPokemonData.length.toString(),
                        'X-Cache-Source': 'memory',
                    },
                });
            } else {
                return NextResponse.json(cachedPokemonData, {
                    headers: {
                        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                        'X-Pokemon-Count': cachedPokemonData.length.toString(),
                        'X-Cache-Source': 'memory',
                    },
                });
            }
        }

        console.log('Fetching fresh Pokemon data from PokeAPI...');

        let allPokemon: PokemonData[] = [];
        try {
            const response = await fetchPokemonList();
            allPokemon = await fetchMultiplePokemonDetails(response.results);
        } catch (error) {
            console.error("Critical error fetching Pokemon data:", error);
            allPokemon = [];
        }

        cachedPokemonData = allPokemon;
        lastFetchTime = now;

        console.log(`Fetched and cached ${allPokemon.length} Pokemon`);

        if (isClientRequest) {
            return NextResponse.json(allPokemon, {
                headers: {
                    'Cache-Control': 'public, max-age=60, stale-while-revalidate=3600',
                    'X-Pokemon-Count': allPokemon.length.toString(),
                    'X-Cache-Source': 'fresh',
                },
            });
        } else {
            return NextResponse.json(allPokemon, {
                headers: {
                    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                    'X-Pokemon-Count': allPokemon.length.toString(),
                    'X-Cache-Source': 'fresh',
                },
            });
        }
    } catch (error) {
        console.error("Error fetching all Pokemon:", error);
        return NextResponse.json([], {
            status: 200,
            headers: {
                'Cache-Control': 'public, max-age=60',
                'X-Pokemon-Count': '0',
                'X-Error': 'Failed to fetch Pokemon data',
            }
        });
    }
}