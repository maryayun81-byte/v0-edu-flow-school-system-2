import { ReactNode } from "react";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // We rely on Middleware for auth protection now to avoid infinite loops
  // with the login page.
  return <>{children}</>;
}
