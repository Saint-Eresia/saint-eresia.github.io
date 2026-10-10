import { cn } from "@/lib/utils";

// Avatar d’un membre, ou son initiale s’il n’en a pas.
export function MemberAvatar({
  member,
  className,
}: {
  member: { name: string; avatarFile: string };
  className?: string;
}) {
  if (member.avatarFile) {
    return (
      <img
        src={`/uploads/${member.avatarFile}`}
        alt=""
        width={256}
        height={256}
        className={cn("shrink-0 rounded-full border border-border object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-primary font-extrabold text-white", className)}
    >
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}
