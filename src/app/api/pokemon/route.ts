import { NextResponse } from 'next/server';
import { getAllPokemon } from '@/app/lib/pokemon';

export async function GET() {
    try {
        const allPokemon = await getAllPokemon();

        return NextResponse.json(allPokemon, {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600', // 5 minutes cache with stale data allowed
                'X-Pokemon-Count': allPokemon.length.toString(),
            },
        });
    } catch (error) {
        console.error("Error in API route:", error);
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