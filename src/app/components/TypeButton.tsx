type TypeButtonProps = {
    type: string;
    selectedTypes: string[];
    toggleType: (type: string) => void;
};

export const TypeButton = ({ type, selectedTypes, toggleType }: TypeButtonProps) => {
    const isSelected = selectedTypes.includes(type);

    return (
        <button
            onClick={() => toggleType(type)}
            className={`border p-4 ${isSelected ? "bg-blue-500 text-white" : ""} cursor-pointer`}
        >
            {type}
        </button>
    );
}; 