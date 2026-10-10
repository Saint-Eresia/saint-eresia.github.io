// Membres de l’équipe repris de l’ancien site, importés seulement si la table est vide.
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { saveAvatar } from "../src/lib/uploads";

const TEAM = [
  {
    name: "Mekki",
    avatar: "mekki.webp",
    roles: ["Fondateur", "Traduction (JA → FR)", "Programmation", "Hacking", "Édition d’images"],
    projects: ["CHAOS;HEAD NOAH", "CHAOS;CHILD", "Rance 01", "Zero no Tsukaima", "Rakudai Kishi no Cavalry", "Suzumiya Haruhi"],
    links: {
      gamebanana: "https://gamebanana.com/members/1957696",
      github: "https://github.com/jabberwockyfool",
      youtube: "https://www.youtube.com/@jabberwockyfool",
      linktree: "https://guns.lol/wrotemysins",
    },
  },
  {
    name: "Medpapaya",
    avatar: "medpapaya.webp",
    roles: ["Fondateur", "Traduction (EN → FR)", "Édition d’images", "Programmation", "Hacking"],
    projects: ["CHAOS;HEAD NOAH", "CHAOS;CHILD", "Rance 01", "Suzumiya Haruhi"],
    links: { gamebanana: "https://gamebanana.com/members/1835686", github: "https://github.com/medlpb" },
  },
  {
    name: "Beatripping",
    avatar: "beatripping.webp",
    roles: ["Traduction (JA → FR)", "Site Internet", "Programmation"],
    projects: ["CHAOS;CHILD", "Rance 01", "Zero no Tsukaima"],
    links: { github: "https://github.com/JemiraCodePrime" },
  },
  {
    name: "Ejder",
    avatar: "ryuu7n.webp",
    roles: ["Communication", "Bêta-test"],
    projects: ["CHAOS;CHILD", "Rakudai Kishi no Cavalry"],
    links: { linktree: "https://guns.lol/ryuu7n" },
  },
];

export async function seedTeam() {
  if (await db.prepare("SELECT 1 FROM team_member").get()) {
    console.log("· Équipe : déjà présente, ignorée");
    return;
  }
  const insert = db.prepare(
    "INSERT INTO team_member (name, avatarFile, roles, projects, links, position) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const [index, member] of TEAM.entries()) {
    const avatarFile = await saveAvatar(await fs.readFile(path.join(import.meta.dirname, "seed-data", "team", member.avatar)));
    await insert.run(member.name, avatarFile, member.roles.join("\n"), member.projects.join("\n"), JSON.stringify(member.links), index + 1);
  }
  console.log(`✓ Équipe : ${TEAM.length} membres`);
}
