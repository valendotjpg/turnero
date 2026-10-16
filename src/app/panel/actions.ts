"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/server/dal";

export async function logout() {
  await endSession();
  redirect("/panel/login");
}
