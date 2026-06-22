import { redirect } from "next/navigation";

export default async function BackofficeHome() {
  redirect("/backoffice/queue");
}
