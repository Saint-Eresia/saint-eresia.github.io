export default function ManageLayout({ children }: LayoutProps<"/gestion">) {
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">{children}</div>;
}
