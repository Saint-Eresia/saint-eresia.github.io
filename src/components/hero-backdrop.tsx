// Fond de l’en-tête d’une fiche (patch ou novel). À placer dans un parent `relative isolate overflow-hidden`.
// Avec un arrière-plan : image nette, assombrie à gauche et en bas pour garder le titre lisible.
// Sinon : la couverture, très floutée.
export function HeroBackdrop({ background, cover }: { background?: string | null; cover?: string | null }) {
  if (background) {
    return (
      <>
        <img src={background} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-60" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background/90 via-background/50 to-background/20" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/30 to-background" />
      </>
    );
  }
  return (
    <>
      {cover && (
        <img
          src={cover}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-30 blur-3xl saturate-150"
        />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-background/40 to-background" />
    </>
  );
}
