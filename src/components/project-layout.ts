// Mise en page des fiches patch et novel. Avec des participants, la fiche s’élargit sur très grand écran (2xl)
// pour afficher la carte « Équipe » dans une troisième colonne, à droite de la carte principale.
// En dessous de 2xl, cette carte passe sous la carte principale.
export function projectLayout(withMembers: boolean) {
  return {
    // Carte principale collée en haut au défilement. Sous 2xl, la carte « Équipe » est juste en dessous :
    // on ne la colle alors qu’en 2xl, pour qu’elle ne passe pas par-dessus.
    sticky: withMembers ? "2xl:sticky 2xl:top-24" : "lg:sticky lg:top-24",
    hero: withMembers ? "mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 2xl:max-w-[88rem]" : "mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6",
    body: withMembers
      ? "mx-auto grid max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:max-w-[88rem] 2xl:grid-cols-[minmax(0,1fr)_20rem_16rem]"
      : "mx-auto grid max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]",
  };
}
