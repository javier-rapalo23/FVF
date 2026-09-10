import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { rutaPorDefecto } from "@/lib/permissions";

export default async function Home() {
  const sesion = await auth();

  if (!sesion?.user) redirect("/login");
  redirect(rutaPorDefecto(sesion.user.rol));
}
