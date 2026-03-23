import { redirect } from "next/navigation";

export default function ConnectionDetailRedirectPage() {
  redirect("/channels");
}