"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from 'swr';
import { Filter } from "./Filter";
import { PokemonCard } from "./PokemonCard";
import { PokemonData } from "../types/pokemon";

async function fetchAllPokemon(): Promise<PokemonData[]> {
    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/pokemon?_t=${timestamp}`, {
            headers: {
                'x-fetch-source': 'client',
                'x-request-time': timestamp.toString()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch Pokemon data from API');
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching all Pokemon:", error);
        throw error;
    }
}

interface PokemonContentProps {
    initialPokemonData?: PokemonData[];
    forceLoading?: boolean;
}

export function PokemonContent({ initialPokemonData = [], forceLoading = false }: PokemonContentProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [allFilteredPokemon, setAllFilteredPokemon] = useState<PokemonData[]>([]);
    const [displayedPokemon, setDisplayedPokemon] = useState<PokemonData[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(forceLoading);
    const itemsPerPage = 24;

    const { data: allPokemonData, error, isLoading, mutate } = useSWR<PokemonData[]>(
        'all-pokemon-data',
        fetchAllPokemon,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 60000,
            keepPreviousData: true,
            fallbackData: initialPokemonData,
            revalidateIfStale: false,
            revalidateOnMount: false,
            refreshInterval: 0,
            errorRetryCount: 3,
        }
    );

    useEffect(() => {
        if (allPokemonData && allPokemonData.length > 0) {
            initializeFromURL();
        }
    }, [allPokemonData]);

    const initializeFromURL = useCallback(() => {
        if (!allPokemonData) return;

        const typeParam = searchParams.get('type');
        const pageParam = searchParams.get('page');
        const page = pageParam ? Math.max(0, parseInt(pageParam) - 1) : 0;

        if (typeParam) {
            const types = typeParam.split(',');
            setSelectedTypes(types);

            filterPokemonData(types, allPokemonData, page);
        } else {
            setSelectedTypes([]);
            setAllFilteredPokemon(allPokemonData);
            setTotalPages(Math.ceil(allPokemonData.length / itemsPerPage));
            setCurrentPage(page);
            updateDisplayedPokemon(allPokemonData, page);
        }
    }, [allPokemonData, searchParams, itemsPerPage]);

    const updateDisplayedPokemon = useCallback((pokemonList: PokemonData[], page: number) => {
        const startIndex = page * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setDisplayedPokemon(pokemonList.slice(startIndex, endIndex));
    }, [itemsPerPage]);

    const filterPokemonData = useCallback((types: string[], pokemonList: PokemonData[], page: number = 0) => {
        if (!pokemonList || !pokemonList.length) return;

        const filtered = pokemonList.filter(pokemon => {
            if (types.length === 1) {
                return pokemon.types.some(type => types.includes(type));
            }

            if (pokemon.types.length !== 2) return false;
            return pokemon.types.every(type => types.includes(type));
        });

        if (filtered.length === 0) {
            setAllFilteredPokemon([]);
            setTotalPages(0);
            setCurrentPage(0);
            setDisplayedPokemon([]);
            return;
        }

        const enhancedPokemon = filtered.map(pokemon => {
            const matchingTypes = pokemon.types.filter(type =>
                types.includes(type)
            );

            matchingTypes.sort((a, b) => {
                return types.indexOf(a) - types.indexOf(b);
            });

            const slots = matchingTypes.map(type =>
                types.indexOf(type) + 1
            );

            return {
                ...pokemon,
                id: typeof pokemon.id === 'number' ? pokemon.id.toString() : pokemon.id,
                matchingTypes,
                slots,
                url: `https://pokeapi.co/api/v2/pokemon/${pokemon.id}/`
            };
        });

        const sortedPokemon = enhancedPokemon.sort((a, b) => {
            if (types.length === 1) {
                return parseInt(a.id?.toString() || "0") - parseInt(b.id?.toString() || "0");
            }

            const aFirstType = a.matchingTypes[0];
            const bFirstType = b.matchingTypes[0];
            const aFirstTypeIndex = types.indexOf(aFirstType);
            const bFirstTypeIndex = types.indexOf(bFirstType);

            if (aFirstTypeIndex !== bFirstTypeIndex) {
                return aFirstTypeIndex - bFirstTypeIndex;
            }

            return parseInt(a.id?.toString() || "0") - parseInt(b.id?.toString() || "0");
        });

        setAllFilteredPokemon(sortedPokemon);

        const filteredCount = sortedPokemon.length;
        setTotalPages(Math.ceil(filteredCount / itemsPerPage));

        setCurrentPage(page);
        updateDisplayedPokemon(sortedPokemon, page);
    }, [itemsPerPage, updateDisplayedPokemon]);

    useEffect(() => {
        const params = new URLSearchParams();

        if (selectedTypes.length > 0) {
            params.set('type', selectedTypes.join(','));
        }

        params.set('page', (currentPage + 1).toString());
        const queryString = params.toString();
        router.push(`?${queryString}`, { scroll: false });
    }, [selectedTypes, currentPage, router, isLoading]);

    useEffect(() => {
        if (allFilteredPokemon.length > 0) {
            updateDisplayedPokemon(allFilteredPokemon, currentPage);
        }
    }, [currentPage, allFilteredPokemon, updateDisplayedPokemon]);

    const toggleType = useCallback((type: string) => {
        let newTypes: string[];

        if (selectedTypes.includes(type)) {
            newTypes = selectedTypes.filter(t => t !== type);
        } else {
            newTypes = [...selectedTypes, type];
        }

        setSelectedTypes(newTypes);

        if (newTypes.length > 0 && allPokemonData) {
            filterPokemonData(newTypes, allPokemonData, 0);
        } else if (allPokemonData) {
            setAllFilteredPokemon(allPokemonData);
            setTotalPages(Math.ceil(allPokemonData.length / itemsPerPage));
            setCurrentPage(0);
            updateDisplayedPokemon(allPokemonData, 0);
        }
    }, [selectedTypes, allPokemonData, filterPokemonData, itemsPerPage, updateDisplayedPokemon]);

    const handleNextPage = useCallback(() => {
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
        }
    }, [currentPage, totalPages]);

    const handlePrevPage = useCallback(() => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    }, [currentPage]);

    const totalCount = allFilteredPokemon.length;

    useEffect(() => {
        if (initialPokemonData.length > 0 && !allPokemonData) {
            const typeParam = searchParams.get('type');
            if (typeParam) {
                const types = typeParam.split(',');
                setSelectedTypes(types);
                filterPokemonData(types, initialPokemonData, 0);
            } else {
                setAllFilteredPokemon(initialPokemonData);
                setTotalPages(Math.ceil(initialPokemonData.length / itemsPerPage));
                setCurrentPage(0);
                updateDisplayedPokemon(initialPokemonData, 0);
            }
        }
    }, [initialPokemonData, allPokemonData, itemsPerPage, updateDisplayedPokemon, searchParams, filterPokemonData]);

    useEffect(() => {
        if (forceLoading) {
            setLoading(true);
            const timer = setTimeout(() => {
                setLoading(false);
            }, 20);

            return () => clearTimeout(timer);
        }
    }, [forceLoading]);

    const isDataLoading = loading || (isLoading && (!allPokemonData || allPokemonData.length === 0));

    return (
        isDataLoading ? (
            <div className="">Loading...</div>
        ) : (
            <div className="flex flex-col gap-4 px-10 relative">
                {error && (
                    <div className="text-red-500">
                        Error loading Pokemon data. Please refresh the page.
                    </div>
                )}

                <h1 className="text-center">Welcome to Pokemon World</h1>

                <p>Total count: {totalCount}</p>

                <Filter
                    selectedTypes={selectedTypes}
                    toggleType={toggleType}
                />

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {displayedPokemon.map((pokemon) => (
                        <PokemonCard
                            key={pokemon.id}
                            pokemon={pokemon}
                        />
                    ))}
                </div>

                <div className="flex justify-center gap-4 py-4">
                    {currentPage > 0 && (
                        <button
                            onClick={handlePrevPage}
                            className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            Previous
                        </button>
                    )}
                    {currentPage < totalPages - 1 && (
                        <button
                            onClick={handleNextPage}
                            className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        )
    );
} 