# Guide de post-édition complète (FPE)

Méthode : **MTPE — Full Post-Editing**. La machine produit un premier jet, le post-éditeur le
reprend jusqu'à un texte de qualité publiable, indiscernable d'une traduction humaine.

À ne pas confondre avec le *Light Post-Editing*, qui se contente de corriger les contresens et
laisse passer les maladresses. En FPE, un passage compréhensible mais qui « sent la machine »
est un défaut à corriger, pas un détail acceptable.

## Chaîne de production

```
_reference/suzumiya-vol4-en/   texte source anglais (Baka-Tsuki)
        │  node scripts/glossaire.js _reference/suzumiya-vol4-en --sortie _reference/glossaire-vol4.md
        │  → glossaire tranché AVANT toute passe machine
        │  node scripts/decouper.js _reference/suzumiya-vol4-en --sortie _reference/a-traduire
_reference/a-traduire/         morceaux .txt + .entete mis de côté
        │  passe machine, en gardant les noms de fichiers
        │  post-édition complète, morceau par morceau (ce guide)
_reference/traduit/            morceaux post-édités, mêmes noms
        │  node scripts/decouper.js --recoller _reference/traduit --sortie content/<roman>/volume-04
content/.../volume-04/         chapitres en statut Brouillon
        │  relecture finale + passage en statut Publié
```

Règle de découpage : un morceau = une unité de post-édition. On ne mélange pas deux morceaux
dans une même passe, et on ne renomme jamais un fichier — `--recoller` s'appuie sur l'ordre
des noms.

## Les quatre passes

Chaque morceau passe dans cet ordre. Ne pas les mener de front : chaque passe a son propre
angle de lecture, et les mener ensemble revient à n'en mener aucune.

### 1. Fidélité — source sous les yeux

- Rien d'ajouté, rien d'omis. La machine escamote volontiers une subordonnée ou une négation.
- Négations, quantités, dates, sujets de verbes : vérifier un à un, c'est là que la machine ment.
- Qui parle ? La machine perd le locuteur dans les échanges sans incise et attribue une réplique
  au mauvais personnage.
- Ce qui est ambigu dans la source reste ambigu dans la traduction : ne pas expliciter.

### 2. Terminologie — glossaire sous les yeux

- Chaque terme de [glossaire-vol4.md](glossaire-vol4.md) est appliqué **sans exception**.
- Une occurrence non listée qui se répète : l'ajouter au glossaire, ne pas trancher dans son coin.
- Suffixes honorifiques : la machine les supprime ou les recolle en « Monsieur Asahina ».
  Contrôle systématique.

### 3. Naturel — source refermée

C'est la passe qui distingue le FPE du reste. On lit **uniquement le français**, à voix haute
si possible : ce qui accroche à l'oreille est un calque.

- **Pronoms** : l'anglais répète le sujet, le français l'élide. « Il ouvrit la porte. Il entra. »
  → « Il ouvrit la porte et entra. »
- **Possessifs** : « il mit sa main dans sa poche » → « il mit la main dans sa poche ».
- **Voix passive** : à retourner à l'actif dans neuf cas sur dix.
- **Verbes de parole** : l'anglais recycle *said*. Le français attend une palette
  (répondit, lança, coupa, souffla) — sans tomber dans le catalogue de synonymes.
- **Ponctuation de dialogue** : chevrons `« … »` avec espaces insécables, tirets cadratins
  pour les répliques enchaînées. Jamais de `"…"` droits : la machine les recopie tels quels.
- **Segmentation** : une longue phrase anglaise à rallonge se coupe en deux. Deux phrases
  hachées se soudent. La machine ne redécoupe jamais d'elle-même.
- **Registre** : Kyon narre au passé simple / imparfait, avec des incises familières.
  La machine relève le registre et le rend plat : rabaisser où il faut.
- **Onomatopées et interjections** : voir la table du glossaire.

### 4. Cohérence — à l'échelle du chapitre

Une fois les morceaux d'un chapitre post-édités, relire le chapitre entier d'affilée :

- Temps verbaux stables d'un morceau à l'autre (la machine bascule au présent sans prévenir).
- Tutoiement / vouvoiement constants par couple de personnages.
- Un même objet ou lieu nommé pareil du début à la fin.
- Les liens d'illustrations `![](/assets/…)` intacts, aux mêmes emplacements.

## Contrôles mécaniques

Avant de recoller, sur `_reference/traduit/` :

```bash
grep -rn '"'            # guillemets droits résiduels
grep -rnE '\b(Hey|Huh|Okay|Well)\b'   # interjections non traduites
grep -rn 'Décembre\|Janvier\|Novembre' # mois avec majuscule
grep -rniE 'SOS.?Brigade|Brigade.?SOS'  # doit ne renvoyer que « Brigade SOS »
grep -rn 'Asahina[^-]'  # -san manquant
```

Contrôle de complétude, morceau par morceau : le nombre de paragraphes doit être identique
entre `a-traduire/` et `traduit/`.

```bash
for f in _reference/traduit/*--*.txt; do
  s=$(grep -c '^$' "_reference/a-traduire/$(basename "$f")")
  t=$(grep -c '^$' "$f")
  [ "$s" = "$t" ] || echo "écart de paragraphes : $(basename "$f") ($s → $t)"
done
```

## Ce qui n'est pas de la post-édition

Si un morceau demande plus de réécriture que de correction — machine hors sujet, passage
poétique, jeu de mots intraduisible —, on abandonne le jet machine et on traduit à la main.
S'acharner à rafistoler un mauvais jet coûte plus cher et donne un texte plus faible.
