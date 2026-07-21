import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

export const metadata: Metadata = {
    title: "Neighborhood Watch Intelligence",
    description: "Real-time crime analytics visualization",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        </body>
        </html>
    );
}