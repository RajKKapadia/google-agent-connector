import { redirect } from "next/navigation";

export default function SignUpRedirectPage() {
  redirect("/login");
}