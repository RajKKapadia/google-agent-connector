import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectionForm } from "@/components/connections/connection-form";

export default function NewConnectionPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">New Connection</h1>
      <Card>
        <CardHeader>
          <CardTitle>Connection Details</CardTitle>
          <CardDescription>
            Link a WhatsApp Business Phone Number to a Google CES AI agent. All
            sensitive credentials are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionForm />
        </CardContent>
      </Card>
    </div>
  );
}
