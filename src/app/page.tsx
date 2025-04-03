import { Suspense } from 'react';
import { PokemonDataProvider } from './components/PokemonDataProvider';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <PokemonDataProvider />
      </Suspense>
    </main>
  );
}

