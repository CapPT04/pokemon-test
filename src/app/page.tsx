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
  const [fetchedPages, setFetchedPages] = useState<{ [key: number]: PokemonData[] }>({});
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
      const page = parseInt(pageParam); // Remove the -1 offset
      if (!isNaN(page) && page >= 1) { // Change condition to check for page >= 1
        setCurrentPage(page - 1); // Subtract 1 here to convert to 0-based index
      }
    }
  }, [searchParams]);

  // Update URL when selectedTypes or currentPage changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedTypes.length > 0) {
      params.set('type', selectedTypes.join(','));
    }

    // Add 1 to currentPage to show 1-based indexing in URL
    params.set('page', (currentPage + 1).toString());

    const queryString = params.toString();
    router.push(`?${queryString}`, { scroll: false });
  }, [selectedTypes, currentPage, router]);

  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Initial load of Pokemon data when page changes (only for unfiltered view)
  useEffect(() => {
    async function loadPokemonData() {
      if (selectedTypes.length === 0) {
        try {
          // If we already have data for this page, use it
          if (fetchedPages[currentPage]) {
            setPokemonData(fetchedPages[currentPage]);
            setDisplayedPokemon(fetchedPages[currentPage]);
            // Update pagination URLs
            const listResponse = await fetchPokemonList(itemsPerPage, currentPage * itemsPerPage);
            setNextPageUrl(listResponse.next);
            setPrevPageUrl(listResponse.previous);
            return;
          }

          setIsLoading(true);

          let offset = 0;
          if (isInitialLoad) {
            offset = currentPage * itemsPerPage;
          } else {
            offset = currentPage * itemsPerPage;
          }

          // Fetch a larger initial set to get more types
          const listResponse = await fetchPokemonList(itemsPerPage, offset);
          setTotalCount(listResponse.count);
          setNextPageUrl(listResponse.next);
          setPrevPageUrl(listResponse.previous);
          setTotalPages(Math.ceil(listResponse.count / itemsPerPage));

          const details = await fetchMultiplePokemonDetails(listResponse.results);

          // Store the fetched data for this page
          setFetchedPages(prev => ({
            ...prev,
            [currentPage]: details
          }));

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
  }, [currentPage, selectedTypes.length, allPokemonLoaded.length, availableTypes.length, isInitialLoad, fetchedPages]);

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
      } else {
        // When no types are selected, fetch the total count from the API
        try {
          const listResponse = await fetchPokemonList(1, 0);
          setTotalCount(listResponse.count);
          setTotalPages(Math.ceil(listResponse.count / itemsPerPage));
        } catch (error) {
          console.error("Error fetching total count:", error);
        }
      }
    }

    filterPokemonByType();
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

    // Update pagination buttons availability based on conditions
    if (selectedTypes.length === 0) {
      if (isInitialLoad) {
        // For initial load: 
        // - Show next button only when on page 0
        // - Show previous button only when on page 2
        // - No buttons on page 1
        setPrevPageUrl(currentPage === 2 ? "available" : null);
        setNextPageUrl(currentPage === 0 ? "available" : null);
      } else {
        // For after deselecting types: show previous button when not on page 0
        setPrevPageUrl(currentPage > 0 ? "available" : null);
        setNextPageUrl(currentPage < totalPages - 1 ? "available" : null);
      }
    } else {
      // For type filtering: show previous button when not on page 0
      setPrevPageUrl(currentPage > 0 ? "available" : null);
      setNextPageUrl(currentPage < totalPages - 1 ? "available" : null);
    }
  }, [allFilteredPokemon, currentPage, itemsPerPage, totalPages, pokemonData, selectedTypes.length, isInitialLoad]);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
      // When deselecting types, mark as not initial load
      setIsInitialLoad(false);
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleNextPage = () => {
    if (selectedTypes.length === 0 && isInitialLoad) {
      // For initial load: jump to page 2 (showing Pokemon 48-71)
      if (currentPage === 0) {
        setCurrentPage(2);
      }
    } else {
      // For other cases: go to next page
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      }
    }
  };

  const handlePrevPage = () => {
    if (selectedTypes.length === 0 && isInitialLoad) {
      // For initial load: go back to page 1 (showing Pokemon 24-47)
      if (currentPage === 2) {
        setCurrentPage(1);
      }
    } else {
      // For other cases: go to previous page
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 px-10 relative">
      {isLoading && (
        <div className="">
          Loading...
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
        {selectedTypes.length === 0 && isInitialLoad ? (
          // For initial load: show buttons based on specific conditions
          <>
            {currentPage === 2 && (
              <button
                onClick={handlePrevPage}
                className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
              >
                Previous
              </button>
            )}
            {currentPage === 0 && (
              <button
                onClick={handleNextPage}
                className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
              >
                Next
              </button>
            )}
          </>
        ) : (
          // For other cases: show buttons based on current page
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

