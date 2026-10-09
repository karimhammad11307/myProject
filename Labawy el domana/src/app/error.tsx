"use client";
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="loading-page"><h1>We couldn’t open this page.</h1><p>Your saved scores are in the database. Please try again.</p><button className="btn primary" onClick={reset}>Try again</button></main>;}
