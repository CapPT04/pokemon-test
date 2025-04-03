import Image from "next/image";
import { PokemonData } from "../types/pokemon";

type PokemonCardProps = {
    pokemon: PokemonData;
};

export const PokemonCard = ({ pokemon }: PokemonCardProps) => {
    const { id, name, imageUrl } = pokemon;


    return (
        <div className="flex flex-col  items-center justify-between border p-4">
            <h3 className="">{name}</h3>
            <div className="">
                <Image
                    className="w-20"
                    alt={name}
                    width={35}
                    height={53}
                    src={imageUrl}
                    unoptimized
                />
            </div>
            <p className="">Number: {id}</p>
        </div>
    );
};