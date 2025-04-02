"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "./components/Filter";
import { PokemonCard } from "./components/PokemonCard";
import { fetchPokemonList, fetchMultiplePokemonDetails, fetchAllPokemon } from "./services/pokemonService";
import { PokemonData } from "./types/pokemon";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [pokemonData, setPokemonData] = useState<PokemonData[]>([]);
  const [allFilteredPokemon, setAllFilteredPokemon] = useState<PokemonData[]>([]);
  const [displayedPokemon, setDisplayedPokemon] = useState<PokemonData[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [prevPageUrl, setPrevPageUrl] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [allPokemonLoaded, setAllPokemonLoaded] = useState<PokemonData[]>([]);
  const itemsPerPage = 24;

  // Load types and page from URL on initial render
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const pageParam = searchParams.get('page');

    if (typeParam) {
      const types = typeParam.split(',');
      setSelectedTypes(types);
    }

    if (pageParam) {
      const page = parseInt(pageParam) - 1; // Convert to 0-based index
      if (!isNaN(page) && page >= 0) {
        setCurrentPage(page);
      }
    }
  }, [searchParams]);

  // Update URL when selectedTypes or currentPage changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedTypes.length > 0) {
      params.set('type', selectedTypes.join(','));
    }

    if (currentPage > 0) {
      params.set('page', (currentPage + 1).toString());
    }

    const queryString = params.toString();
    if (queryString) {
      router.push(`?${queryString}`);
    } else {
      router.push('/');
    }
  }, [selectedTypes, currentPage, router]);

  // Initial load of Pokemon data when page changes (only for unfiltered view)
  useEffect(() => {
    async function loadPokemonData() {
      if (selectedTypes.length === 0) {
        try {
          setIsLoading(true);

          // Fetch a larger initial set to get more types
          const listResponse = await fetchPokemonList(itemsPerPage, currentPage * itemsPerPage);
          setTotalCount(listResponse.count);
          setNextPageUrl(listResponse.next);
          setPrevPageUrl(listResponse.previous);
          setTotalPages(Math.ceil(listResponse.count / itemsPerPage));

          const details = await fetchMultiplePokemonDetails(listResponse.results);
          setPokemonData(details);
          setAllFilteredPokemon(details);
          setDisplayedPokemon(details);

          // For type filtering, we want to know all available types
          // Load all Pokemon only once (first time)
          if (allPokemonLoaded.length === 0) {
            try {
              // Start fetching all Pokemon in background
              fetchAllPokemon().then(allPokemon => {
                setAllPokemonLoaded(allPokemon);

                // Extract all available types
                const types = new Set<string>();
                allPokemon.forEach(pokemon => {
                  pokemon.types.forEach(type => types.add(type));
                });

                setAvailableTypes(Array.from(types).sort());
              }).catch(error => {
                console.error("Error loading all Pokemon:", error);
              });

              // While all Pokemon are loading, show types from current page
              if (availableTypes.length === 0) {
                const types = new Set<string>();
                details.forEach(pokemon => {
                  pokemon.types.forEach(type => types.add(type));
                });
                setAvailableTypes(Array.from(types).sort());
              }
            } catch (error) {
              console.error("Error initializing Pokemon data:", error);

              // Fallback to types from current page
              const types = new Set<string>();
              details.forEach(pokemon => {
                pokemon.types.forEach(type => types.add(type));
              });
              setAvailableTypes(Array.from(types).sort());
            }
          }
        } catch (error) {
          console.error("Error fetching Pokemon data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    }

    loadPokemonData();
  }, [currentPage, selectedTypes.length, allPokemonLoaded.length, availableTypes.length]);

  // This effect is for filtering Pokemon when a type is selected
  useEffect(() => {
    async function filterPokemonByType() {
      if (selectedTypes.length > 0) {
        try {
          setIsLoading(true);

          let pokemonToFilter: PokemonData[] = [];

          // Use the already loaded Pokemon list if available
          if (allPokemonLoaded.length > 0) {
            pokemonToFilter = allPokemonLoaded;
          } else {
            // If not loaded yet, fetch all
            pokemonToFilter = await fetchAllPokemon();
            setAllPokemonLoaded(pokemonToFilter);
          }

          // Filter them by the selected types
          const filtered = pokemonToFilter.filter(pokemon => {
            // Nếu chỉ chọn 1 type, cho phép Pokemon có 1 hoặc 2 types
            if (selectedTypes.length === 1) {
              return pokemon.types.some(type => selectedTypes.includes(type));
            }

            // Nếu chọn nhiều hơn 1 type, chỉ lấy Pokemon có đúng 2 types
            if (pokemon.types.length !== 2) return false;

            // Kiểm tra xem cả 2 types của Pokemon có nằm trong danh sách types được chọn không
            return pokemon.types.every(type => selectedTypes.includes(type));
          });

          // Group and enhance Pokemon data as before
          const enhancedPokemon = filtered.map(pokemon => {
            const matchingTypes = pokemon.types.filter(type =>
              selectedTypes.includes(type)
            );

            // Sắp xếp matchingTypes theo thứ tự trong selectedTypes
            matchingTypes.sort((a, b) => {
              return selectedTypes.indexOf(a) - selectedTypes.indexOf(b);
            });

            const slots = matchingTypes.map(type =>
              selectedTypes.indexOf(type) + 1
            );

            return {
              ...pokemon,
              id: typeof pokemon.id === 'number' ? pokemon.id.toString() : pokemon.id,
              matchingTypes,
              slots,
              url: `https://pokeapi.co/api/v2/pokemon/${pokemon.id}/`
            };
          });

          // Sort Pokemon based on type combinations and ID
          const sortedPokemon = enhancedPokemon.sort((a, b) => {
            // Nếu chỉ chọn 1 type, sắp xếp theo ID
            if (selectedTypes.length === 1) {
              return parseInt(a.id?.toString() || "0") - parseInt(b.id?.toString() || "0");
            }

            // Lấy type đầu tiên của mỗi Pokemon
            const aFirstType = a.matchingTypes[0];
            const bFirstType = b.matchingTypes[0];

            // So sánh vị trí của type đầu tiên trong mảng selectedTypes
            const aFirstTypeIndex = selectedTypes.indexOf(aFirstType);
            const bFirstTypeIndex = selectedTypes.indexOf(bFirstType);

            // Nếu type đầu tiên khác nhau, sắp xếp theo vị trí trong selectedTypes
            if (aFirstTypeIndex !== bFirstTypeIndex) {
              return aFirstTypeIndex - bFirstTypeIndex;
            }

            // Nếu type đầu tiên giống nhau, sắp xếp theo ID
            return parseInt(a.id?.toString() || "0") - parseInt(b.id?.toString() || "0");
          });

          // Store all filtered Pokemon
          setAllFilteredPokemon(sortedPokemon as PokemonData[]);

          // Calculate total pages
          setTotalCount(sortedPokemon.length);
          setTotalPages(Math.ceil(sortedPokemon.length / itemsPerPage));

          // Reset to first page only when types change
          const currentTypes = searchParams.get('type')?.split(',') || [];
          if (JSON.stringify(currentTypes) !== JSON.stringify(selectedTypes)) {
            setCurrentPage(0);
          }

          console.log(`Found ${sortedPokemon.length} Pokemon with type: ${selectedTypes.join(", ")}`);

        } catch (error) {
          console.error("Error filtering Pokemon by type:", error);
        } finally {
          setIsLoading(false);
        }
      }
    }

    if (selectedTypes.length > 0) {
      filterPokemonByType();
    }
  }, [selectedTypes, allPokemonLoaded, searchParams]);

  // This effect updates the displayed Pokemon based on the current page and filtered Pokemon
  useEffect(() => {
    if (selectedTypes.length === 0) {
      // If no types selected, use the paginated data directly
      setDisplayedPokemon(pokemonData);
    } else {
      // If types are selected, slice from filtered data
      const startIndex = currentPage * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      setDisplayedPokemon(allFilteredPokemon.slice(startIndex, endIndex));
    }

    // Update pagination buttons availability
    setPrevPageUrl(currentPage > 0 ? "available" : null);
    setNextPageUrl(currentPage < totalPages - 1 ? "available" : null);
  }, [allFilteredPokemon, currentPage, itemsPerPage, totalPages, pokemonData, selectedTypes.length]);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-10">
      <h1 className="text-center">Welcome to Pokemon World</h1>
      <p className="">Total count: {totalCount}</p>

      <Filter
        selectedTypes={selectedTypes}
        toggleType={toggleType}
        availableTypes={availableTypes}
        isLoading={isLoading}
      />

      <section className="grid grid-cols-6 gap-x-16 gap-y-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-2"></div>
              <p>{selectedTypes.length > 0 ? "Loading all Pokémon with selected types..." : "Loading Pokémon..."}</p>
            </div>
          </div>
        ) : displayedPokemon.length > 0 ? (
          displayedPokemon.map((pokemon) => (
            <PokemonCard
              key={pokemon.id}
              pokemon={pokemon}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            No Pokémon found with the selected type(s)
          </div>
        )}
      </section>

      <div className="flex justify-center gap-4 my-6">
        {currentPage > 0 && (
          <button
            onClick={handlePrevPage}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md ${isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            Previous
          </button>
        )}

        {currentPage < totalPages - 1 && (
          <button
            onClick={handleNextPage}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md ${isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

