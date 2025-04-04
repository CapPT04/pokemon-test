import { PokemonContent } from "./PokemonContent";
import { getAllPokemon } from "../lib/pokemon";

export async function PokemonDataProvider() {
    // Fetch Pokemon data directly from the server component
    const pokemonData = await getAllPokemon();

    return <PokemonContent initialPokemonData={pokemonData} forceLoading={true} />;
}