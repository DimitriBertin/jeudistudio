import BirdFlock from "@/components/birdFlock";

export default function Home() {
  return (
    <div className="p-12 h-full w-full flex flex-wrap items-center">
      <div className="app">
        <h1 className="app-title">
          <span className="app-logo">Jeudi Studio</span>
          <span className="app-slogan">Collectif d’artistes digitales</span>
        </h1>
        <p className="app-content">L&apos;art, comme l&apos;oiseau, ne se laisse ni enfermer ni dompter. Il vole d&apos;idée en émotion, frôle les nuages du doute, et chante parfois des vérités que les hommes ont oubliées. Un pinceau, un mot, une note, tout cela n’est qu’un battement d’aile dans le ciel vaste de la création. Là où l’oiseau cherche le vent, l’artiste cherche l’élan. Tous deux vivent en équilibre précaire entre le vide et le vertige, mais c’est dans ce déséquilibre qu’ils trouvent leur grâce.</p>
      </div>
      <BirdFlock />
    </div>
  );
}
