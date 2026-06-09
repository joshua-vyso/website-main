import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <Image
              src="/logo.png"
              alt="Vyso"
              width={90}
              height={36}
              className="h-8 w-auto mb-4"
            />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              AI-powered operations and automation for food businesses in Africa.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-4 text-foreground">Navigation</p>
            <div className="flex flex-col gap-2.5">
              {[
                ["Services", "/services"],
                ["Apps", "/apps"],
                ["About", "/about"],
                ["Contact", "/contact"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-4 text-foreground">Get in touch</p>
            <a
              href="mailto:joshua@vyso.co.za"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors block mb-3"
            >
              joshua@vyso.co.za
            </a>
            <Link
              href="https://calendly.com/joshua-vyso/new-meeting"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Book a 15-min call →
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {year} Vyso. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">vyso.co.za</p>
        </div>
      </div>
    </footer>
  );
}
