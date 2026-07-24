import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in or create account | Vyso",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
