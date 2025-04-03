"use client";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from 'swr';
import { Filter } from "./components/Filter";
import { PokemonCard } from "./components/PokemonCard";
import { fetchAllPokemon, getCachedPokemonData } from "./services/pokemonService";
import { PokemonData } from "./types/pokemon";

// Create a client component that uses useSearchParams
function PokemonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [allFilteredPokemon, setAllFilteredPokemon] = useState<PokemonData[]>([]);
  const [displayedPokemon, setDisplayedPokemon] = useState<PokemonData[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const itemsPerPage = 24;

  // Immediately load cached data if available
  const [initialData, setInitialData] = useState<PokemonData[] | undefined>(undefined);

  useEffect(() => {
    // Get cached data as initial data when component mounts
    const cachedData = getCachedPokemonData();
    if (cachedData) {
      setInitialData(cachedData);
    }
  }, []);

  // Use SWR to fetch and cache all Pokemon data
  const { data: allPokemonData, error, isLoading } = useSWR<PokemonData[]>(
    'all-pokemon-data',
    fetchAllPokemon,
    {
      fallbackData: initialData,     // Use initialData as fallback before fetching
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600000,     // 1 hour - don't refetch for 1 hour
      keepPreviousData: true,
      suspense: false
    }
  );

  // Initialize data from URL parameters when Pokemon data is loaded
  useEffect(() => {
    if (allPokemonData && allPokemonData.length > 0) {
      // Initialize from URL if needed
      initializeFromURL();
    }
  }, [allPokemonData]);

  // Initialize from URL parameters
  const initializeFromURL = useCallback(() => {
    if (!allPokemonData) return;

    const typeParam = searchParams.get('type');
    const pageParam = searchParams.get('page');
    const page = pageParam ? Math.max(0, parseInt(pageParam) - 1) : 0;

    // Initialize selected types from URL
    if (typeParam) {
      const types = typeParam.split(',');
      setSelectedTypes(types);

      // Filter Pokemon
      filterPokemonData(types, allPokemonData, page);
    } else {
      // Show all Pokemon
      setAllFilteredPokemon(allPokemonData);
      setTotalPages(Math.ceil(allPokemonData.length / itemsPerPage));
      setCurrentPage(page);
      updateDisplayedPokemon(allPokemonData, page);
    }
  }, [allPokemonData, searchParams, itemsPerPage]);

  // Filter Pokemon data
  const filterPokemonData = useCallback((types: string[], pokemonList: PokemonData[], page: number = 0) => {
    if (!pokemonList || !pokemonList.length) return;

    // Filter by selected types
    const filtered = pokemonList.filter(pokemon => {
      if (types.length === 1) {
        return pokemon.types.some(type => types.includes(type));
      }

      if (pokemon.types.length !== 2) return false;
      return pokemon.types.every(type => types.includes(type));
    });

    // Enhance Pokemon data
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

    // Sort Pokemon
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

    // Set the filtered data
    setAllFilteredPokemon(sortedPokemon);

    // Set total pages
    const filteredCount = sortedPokemon.length;
    setTotalPages(Math.ceil(filteredCount / itemsPerPage));

    // Set current page and update displayed Pokemon
    setCurrentPage(page);
    updateDisplayedPokemon(sortedPokemon, page);
  }, [itemsPerPage]);

  // Update displayed Pokemon
  const updateDisplayedPokemon = useCallback((pokemonList: PokemonData[], page: number) => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedPokemon(pokemonList.slice(startIndex, endIndex));
  }, [itemsPerPage]);

  // Update URL when selectedTypes or currentPage changes
  useEffect(() => {
    // Skip during initial loading
    if (isLoading) return;

    const params = new URLSearchParams();

    if (selectedTypes.length > 0) {
      params.set('type', selectedTypes.join(','));
    }

    // Add 1 to currentPage to show 1-based indexing in URL
    params.set('page', (currentPage + 1).toString());

    const queryString = params.toString();
    router.push(`?${queryString}`, { scroll: false });
  }, [selectedTypes, currentPage, router, isLoading]);

  // Update displayed Pokemon when current page changes
  useEffect(() => {
    if (allFilteredPokemon.length > 0) {
      updateDisplayedPokemon(allFilteredPokemon, currentPage);
    }
  }, [currentPage, allFilteredPokemon, updateDisplayedPokemon]);

  // Toggle type selection
  const toggleType = useCallback((type: string) => {
    let newTypes: string[];

    if (selectedTypes.includes(type)) {
      newTypes = selectedTypes.filter(t => t !== type);
    } else {
      newTypes = [...selectedTypes, type];
    }

    setSelectedTypes(newTypes);

    if (newTypes.length > 0 && allPokemonData) {
      filterPokemonData(newTypes, allPokemonData, 0); // Reset to first page on filter change
    } else if (allPokemonData) {
      // If no types selected, show all pokemon with pagination
      setAllFilteredPokemon(allPokemonData);
      setTotalPages(Math.ceil(allPokemonData.length / itemsPerPage));
      setCurrentPage(0);
      updateDisplayedPokemon(allPokemonData, 0);
    }
  }, [selectedTypes, allPokemonData, filterPokemonData, itemsPerPage, updateDisplayedPokemon]);

  // Handle pagination
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

  // Generate total count for display
  const totalCount = allFilteredPokemon.length || (allPokemonData?.length || 0);

  return (
    <div className="flex flex-col gap-4 px-10 relative">
      {isLoading && !initialData && (
        <div className="">
          Loading...
        </div>
      )}

      {error && (
        <div className="text-red-500">
          Error loading Pokemon data. Please refresh the page.
        </div>
      )}

      <h1 className="text-center">Welcome to Pokemon World</h1>

      <p className="">Total count: {totalCount}</p>

      <Filter
        selectedTypes={selectedTypes}
        toggleType={toggleType}
      />

      <section className="grid grid-cols-6 gap-x-16 gap-y-6">
        {displayedPokemon.map((pokemon) => (
          <PokemonCard
            key={pokemon.id}
            pokemon={pokemon}
          />
        ))}
      </section>

      <div className="flex justify-center gap-4 my-6">
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
  );
}

// Main component that wraps PokemonContent in a Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PokemonContent />
    </Suspense>
  );
}

