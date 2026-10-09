import { Suspense } from "react";
import { ClubApp } from "@/components/club-app";
export default function Page() {return <Suspense fallback={<main className="loading-page">Setting the table…</main>}><ClubApp/></Suspense>;}
