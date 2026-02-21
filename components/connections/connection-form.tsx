"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
  whatsappPhoneNumberId: z.string().min(1, "Sender ID (Phone Number ID) is required"),
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* ── General ── */}
        <section>
          <h3 className="text-lg font-semibold mb-4">General</h3>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Connection Name</FormLabel>
                <FormControl>
                  <Input placeholder="My WhatsApp Bot" {...field} />
                </FormControl>
                <FormDescription>
                  A friendly name to identify this connection.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* ── WhatsApp / Meta ── */}
        <section>
          <h3 className="text-lg font-semibold mb-4">WhatsApp / Meta</h3>
          <div className="space-y-4">
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
                    Found in Meta for Developers &rarr; Your App &rarr; Settings &rarr; Basic.
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
                    Found in App Settings &rarr; Basic &rarr; App Secret. Used to verify
                    webhook signatures. Stored encrypted.
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
                    Found in Meta Business Manager &rarr; WhatsApp &rarr; Phone Numbers.
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
                    Permanent access token from Meta Business Manager. Stored encrypted.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* ── Google CES Agent ── */}
        <section>
          <h3 className="text-lg font-semibold mb-4">Google CES Agent</h3>
          <div className="space-y-4">
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
                    Full deployment path if you want to target a specific deployment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="googleAccessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Account JSON</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                      className="font-mono text-sm min-h-[140px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
                    <p className="font-semibold mb-2">
                      How to create a Service Account
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>
                        Open{" "}
                        <a
                          href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium"
                        >
                          Google Cloud Console → IAM → Service Accounts
                        </a>
                      </li>
                      <li>Click <strong>Create Service Account</strong>, give it a name.</li>
                      <li>
                        Grant the role{" "}
                        <code className="rounded bg-blue-100 px-1.5 py-0.5 dark:bg-blue-900">
                          Dialogflow API Client
                        </code>{" "}
                        (or a custom role with CES permissions).
                      </li>
                      <li>Open the service account → <strong>Keys</strong> tab → <strong>Add Key → Create new key → JSON</strong>.</li>
                      <li>Download the JSON file and paste its full contents above.</li>
                    </ol>
                    <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                      The JSON key is stored encrypted. Tokens are automatically refreshed — no manual rotation needed.
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex gap-4 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Connection"}
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
