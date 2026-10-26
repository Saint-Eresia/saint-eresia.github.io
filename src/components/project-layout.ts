// Mise en page des fiches patch et novel. La carte « Équipe » n’est rendue qu’une fois ; seule la grille
// la place : sous la carte principale (lg), puis dans une troisième colonne sur très grand écran (2xl),
// la fiche s’élargissant alors. Sur mobile : carte principale, carte Équipe, puis le contenu.
export function projectLayout(withMembers: boolean) {
  if (!withMembers) {
    return {
      hero: "mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6",
      // Même largeur que hero, sans marges verticales (en-tête à bandeau des novels).
      container: "mx-auto max-w-6xl px-4 sm:px-6",
      body: "mx-auto grid max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]",
      aside: "lg:col-start-2 lg:row-start-1",
      sticky: "lg:sticky lg:top-24",
      members: "hidden",
      content: "min-w-0 lg:col-start-1 lg:row-start-1",
    };
  }
  return {
    hero: "mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 2xl:max-w-[88rem]",
    container: "mx-auto max-w-6xl px-4 sm:px-6 2xl:max-w-[88rem]",
    body:
      "mx-auto grid max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] 2xl:max-w-[88rem] 2xl:grid-cols-[minmax(0,1fr)_20rem_16rem]",
    // En 2xl, les deux colonnes de droite couvrent toute la hauteur : leurs cartes peuvent rester collées en haut.
    aside: "lg:col-start-2 lg:row-start-1 2xl:row-span-2",
    // Sous 2xl, la carte Équipe est juste en dessous : la carte principale n’est collée qu’en 2xl.
    sticky: "2xl:sticky 2xl:top-24",
    members: "self-start lg:col-start-2 lg:row-start-2 2xl:col-start-3 2xl:row-start-1 2xl:row-span-2 2xl:self-stretch",
    content: "min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-2",
  };
}
