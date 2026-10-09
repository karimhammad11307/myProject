"use client";
import { createContext, useContext } from "react";
import type { State } from "@/lib/types";
export type ClubContextType={data:State;href:(path:string)=>string;refresh:()=>Promise<void>;notify:(message:string,kind?:"success"|"error")=>void;perform:<T=Record<string,unknown>>(path:string,body:unknown)=>Promise<T>};
export const ClubContext=createContext<ClubContextType|null>(null);
export function useClub(){const value=useContext(ClubContext);if(!value)throw new Error("Missing league context");return value;}
