import { redirect } from "next/navigation";

export default function NewConnectionPage() {
  redirect("/channels/new?type=whatsapp");
}
