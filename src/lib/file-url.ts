// Adresse publique d’une image à partir de la valeur gardée en base :
// une adresse complète (Vercel Blob) est renvoyée telle quelle ; un nom de fichier est servi par /uploads/.
export const fileUrl = (file: string) => (/^https?:\/\//.test(file) ? file : `/uploads/${file}`);
