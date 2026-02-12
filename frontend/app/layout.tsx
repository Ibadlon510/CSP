import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "UAE CSP-ERP",
  description: "Multi-tenant SaaS for Corporate Service Providers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
