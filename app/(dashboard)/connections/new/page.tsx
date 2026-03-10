import {
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectionForm } from "@/components/connections/connection-form";

const checklist = [
  "Choose connector type: WhatsApp or Website Widget",
  "For website widgets: allowed domain and style settings",
  "For WhatsApp: Meta App ID, App Secret, phone ID, and access token",
  "CES app version path and optional deployment path",
  "Google service account JSON with CES access",
];

const nextSteps = [
  "Create the connection and store credentials encrypted at rest.",
  "Copy the webhook URL and verify token from the connection detail page.",
  "Register the webhook in Meta and subscribe to the messages field.",
  "Send a test WhatsApp message and verify the session appears in the dashboard.",
];

export default function NewConnectionPage() {
  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create Connection
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a WhatsApp or Website Widget connector and link it to a CES agent for live conversations.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
        >
          Secure Setup
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <section className="space-y-6">
          <Card className="overflow-hidden border-border/70">
            <CardHeader className="gap-4 border-b bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,0.96))]">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border bg-background/90 p-2 shadow-sm">
                  <Webhook className="h-4 w-4 text-sky-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-foreground">
                    Connection Details
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="mt-2 border-sky-200 bg-sky-50 text-sky-700"
                  >
                    Encrypted credential storage
                  </Badge>
                </div>
              </div>
              <CardDescription className="max-w-2xl text-muted-foreground">
                Enter the WhatsApp and CES credentials for this connector. The
                app secret, access tokens, and service account JSON are stored
                encrypted before they touch the database.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ConnectionForm />
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-sky-600" />
                What You Need
              </CardTitle>
              <CardDescription>
                Gather these values before you submit the form.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border bg-muted/20 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="h-4 w-4 text-sky-600" />
                After Creation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {nextSteps.map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                    {index + 1}
                  </div>
                  <p>{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-sky-600" />
                Security Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Credential fields are encrypted with the configured
                `ENCRYPTION_KEY` before storage.
              </p>
              <p>
                The Meta App Secret is used to verify inbound webhook
                signatures, so it should match the app tied to the phone number.
              </p>
              <p>
                The Google service account key should only include the CES
                access required for this workflow.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
