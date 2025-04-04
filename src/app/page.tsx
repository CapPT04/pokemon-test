import { Suspense } from 'react';
import { PokemonDataProvider } from './components/PokemonDataProvider';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense>
        <PokemonDataProvider />
      </Suspense>
    </main>
  );
}

