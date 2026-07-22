import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../hooks/useAuth";
import NetworkStatus from "@/components/ui/NetworkStatus";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "NOUN HRMS",
    description: "National Open University of Nigeria - Human Resource Management System",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="light" style={{ colorScheme: 'light' }}>
            <body className={`${inter.className} bg-slate-50 text-slate-900`} style={{ colorScheme: 'light' }}>
                <AuthProvider>
                    {children}
                    <NetworkStatus />
                </AuthProvider>
            </body>
        </html>
    );
}
