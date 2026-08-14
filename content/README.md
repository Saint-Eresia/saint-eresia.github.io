# Où déposer les textes traduits

Un fichier = une unité lisible sur le site. Le **chemin du fichier détermine l'URL** : ne renommez pas
un fichier déjà publié sans prévenir, le lien deviendrait mort.

## Romans publiés au tome

Rakudai Kishi no Cavalry et Zero no Tsukaima se lisent tome par tome : un seul fichier par tome.

```
content/rakudai-kishi-no-cavalry/tome-01.md
content/rakudai-kishi-no-cavalry/tome-02.md
content/zero-no-tsukaima/tome-01.md
```

## Romans publiés au chapitre

La Mélancolie d'Haruhi Suzumiya se lit chapitre par chapitre : un dossier par tome.

```
content/la-melancolie-de-haruhi-suzumiya/volume-01/chapitre-01.md
content/la-melancolie-de-haruhi-suzumiya/volume-01/chapitre-02.md
content/la-melancolie-de-haruhi-suzumiya/volume-02/chapitre-01.md
```

## Modèles prêts à copier

Deux modèles commentés se trouvent dans `_modeles/` :

- `_modeles/tome.md` pour un tome entier (Rakudai, Zero no Tsukaima)
- `_modeles/chapitre.md` pour un chapitre isolé (Suzumiya)

Copiez-en un dans le bon dossier, renommez-le selon la convention ci-dessus, remplissez l'en-tête
et supprimez le bloc de commentaire.

Tout fichier ou dossier commençant par `_` est ignoré à l'import : vous pouvez y laisser des
brouillons ou des notes de travail sans qu'ils partent en ligne.

## Partir d'un PDF

Si une traduction existe déjà en PDF, le convertisseur en tire un Markdown de départ :

```bash
npm run pdf:md -- tome1.pdf --sortie content/zero-no-tsukaima/tome-01.md
npm run pdf:md -- volume1.pdf --decouper --dossier content/la-melancolie-de-haruhi-suzumiya/volume-01
```

Il reconstitue les paragraphes, recolle les mots coupés en fin de ligne, retire en-têtes courants et
numéros de page, convertit les titres de chapitre en `##` et les séparations de scène en `---`.

Options : `--titre`, `--traducteur`, `--statut`, `--date` pour pré-remplir l'en-tête.

**Le résultat demande toujours une relecture.** L'italique n'est pas détecté, et un PDF scanné ne
donnera rien du tout — il ne contient pas de texte, seulement des images.

## Format d'un fichier

En-tête entre deux lignes `---`, puis le texte. Seul `titre` est vraiment utile ; le reste a des valeurs
par défaut raisonnables.

```markdown
---
titre: Le serment des lanternes
statut: Publié
traducteur: Saint Eresia
date: 2026-08-20
---

Le premier paragraphe.

Le deuxième paragraphe. Une ligne vide sépare deux paragraphes.

## Un intertitre

*italique*, **gras**, et > pour une citation.
```

- `statut` : `Brouillon` (défaut), `Publié` ou `Archivé`. Seuls les chapitres publiés sont visibles des lecteurs.
- `traducteur` : à renseigner quand il diffère de l'équipe créditée sur le roman — par exemple les
  chapitres de Suzumiya repris de Baka-tsuki.
- `date` : date de publication, au format `AAAA-MM-JJ`.

Le Markdown accepté est volontairement limité : paragraphes, `##` et `###`, `*italique*`, `**gras**`,
citations `>`, listes `-` et `1.`, et `---` pour une séparation. Tout le reste est retiré à l'import.

## Publier

```bash
npm run content:import
```

Le script relit tout le dossier et régénère `server/data/content.json`, que le site charge au démarrage.
Relancez le serveur pour voir le résultat.

## Fichiers .txt

Un `.txt` sans en-tête fonctionne aussi : les paragraphes sont déduits des lignes vides, le titre est
tiré du nom du fichier. Pratique pour un premier import en masse, à enrichir ensuite.
