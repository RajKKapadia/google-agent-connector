"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Bot, LockKeyhole, MessageSquareMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createConnection } from "@/lib/actions/connections";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  whatsappAppId: z.string().min(1, "Meta App ID is required"),
  whatsappAppSecret: z.string().min(1, "Meta App Secret is required"),
  whatsappPhoneNumberId: z
    .string()
    .min(1, "Sender ID (Phone Number ID) is required"),
  whatsappAccessToken: z.string().min(1, "WhatsApp Access Token is required"),
  cesAppVersion: z
    .string()
    .min(1, "CES App Version path is required")
    .refine(
      (s) => s.includes("/versions/"),
      "Must be a full app version path (e.g. projects/.../versions/...)"
    ),
  cesDeployment: z.string().optional(),
  googleAccessToken: z.string().min(1, "Google Access Token is required"),
});

type FormValues = z.infer<typeof formSchema>;

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-muted/15 p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl border bg-background p-2">
          <Icon className="h-4 w-4 text-sky-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ConnectionForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      whatsappAppId: "",
      whatsappAppSecret: "",
      whatsappPhoneNumberId: "",
      whatsappAccessToken: "",
      cesAppVersion: "",
      cesDeployment: "",
      googleAccessToken: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await createConnection(values);
      if (result.success) {
        toast.success("Connection created successfully!");
        router.push(`/connections/${result.data?.id}`);
      } else {
        toast.error(result.error);
        if (result.fieldErrors) {
          for (const [field, errors] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof FormValues, { message: errors[0] });
          }
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <SectionShell
          title="General"
          description="Give the connection a clear internal name so it is easy to identify in the dashboard."
          icon={MessageSquareMore}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Connection Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Support Line" {...field} />
                </FormControl>
                <FormDescription>
                  This label is only shown inside your workspace.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionShell>

        <SectionShell
          title="WhatsApp / Meta"
          description="These values identify the sending phone number and verify incoming webhook traffic."
          icon={LockKeyhole}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="whatsappAppId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123456789012345"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Meta for Developers → App Settings → Basic.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsappPhoneNumberId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sender ID (Phone Number ID)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123456789012345"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Meta Business Manager → WhatsApp → Phone Numbers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsappAppSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App Secret</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="App Secret"
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Used to verify webhook signatures. Stored encrypted.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsappAccessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp Access Token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="EAABs..."
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Prefer a permanent system user token. Stored encrypted.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionShell>

        <SectionShell
          title="Google CES Agent"
          description="Point the connector at the CES app version you want to run and provide a service account for authentication."
          icon={Bot}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <FormField
              control={form.control}
              name="cesAppVersion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App Version</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="projects/my-project/locations/us/apps/app-id/versions/version-id"
                      className="font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Full version path from the CES console.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cesDeployment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deployment (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="projects/my-project/locations/us/apps/app-id/deployments/deployment-id"
                      className="font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use this when traffic should target a specific deployment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-5 space-y-4">
            <FormField
              control={form.control}
              name="googleAccessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Account JSON</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                      className="min-h-48 resize-y font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Paste the full JSON key contents. The connector refreshes
                    access tokens automatically.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <p className="font-semibold">Service account checklist</p>
              <ol className="mt-2 space-y-1.5 text-sky-900">
                <li>1. Create a service account in Google Cloud IAM.</li>
                <li>2. Grant the CES-compatible client role you intend to use.</li>
                <li>3. Create a JSON key and paste the full contents above.</li>
                <li>4. Keep the original file out of source control and shared docs.</li>
              </ol>
            </div>
          </div>
        </SectionShell>

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row">
          <Button type="submit" disabled={isSubmitting} className="sm:min-w-40">
            {isSubmitting ? "Creating..." : "Create Connection"}
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/connections")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
