import { redirect } from "next/navigation";

export default function SessionDetailRedirectPage() {
  redirect("/conversations");
}