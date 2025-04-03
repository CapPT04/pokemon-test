import { TypeButton } from "./TypeButton";

type FilterProps = {
    selectedTypes: string[];
    toggleType: (type: string) => void;
    availableTypes?: string[];
};

export const Filter = ({ selectedTypes, toggleType, availableTypes }: FilterProps) => {
    const defaultTypes = [
        "normal", "fighting", "flying", "poison", "ground",
        "rock", "bug", "ghost", "steel", "fire", "water",
        "grass", "electric", "psychic", "ice", "dragon",
        "dark", "fairy", "stellar", "unknown"
    ];

    const pokemonTypes = availableTypes && availableTypes.length > 0
        ? availableTypes
        : defaultTypes;

    return (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span>Types: </span>
            {pokemonTypes.map(type => (
                <TypeButton
                    key={type}
                    type={type}
                    selectedTypes={selectedTypes}
                    toggleType={toggleType}
                />
            ))}
        </section>
    );
}; 