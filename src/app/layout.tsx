import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StudioShell } from "@/components/studio/studio-shell";
import { SITE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// Applies the saved theme and text size before first paint to avoid a light/dark flash.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("lookahead-theme"),s=localStorage.getItem("lookahead-scale");if(t==="light"||t==="dark")d.dataset.theme=t;if(s)d.dataset.scale=s}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StudioShell>{children}</StudioShell>
      </body>
    </html>
  );
}
