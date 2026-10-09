import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Labawy El-Domana · لباوي الضومنة",description:"لباوي الضومنة — Your café companion for domino scores, friends, and league standings.",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
