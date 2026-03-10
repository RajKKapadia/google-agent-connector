"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  Bot,
  Globe,
  LockKeyhole,
  MessageSquareMore,
  Palette,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createConnection } from "@/lib/actions/connections";

const formSchema = z.object({
  type: z.enum(["whatsapp", "website"]),
  name: z.string().min(1, "Name is required").max(100),
  whatsappAppId: z.string().optional(),
  whatsappAppSecret: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  websiteDomain: z.string().optional(),
  widgetBubbleColor: z.string().optional(),
  widgetFontFamily: z.string().optional(),
  widgetGreeting: z.string().optional(),
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
      type: "whatsapp",
      name: "",
      whatsappAppId: "",
      whatsappAppSecret: "",
      whatsappPhoneNumberId: "",
      whatsappAccessToken: "",
      websiteDomain: "",
      widgetBubbleColor: "#2563eb",
      widgetFontFamily: "Inter, system-ui, sans-serif",
      widgetGreeting: "Hi! How can we help today?",
      cesAppVersion: "",
      cesDeployment: "",
      googleAccessToken: "",
    },
  });

  const connectionType = useWatch({ control: form.control, name: "type" });

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
          description="Choose a connector type and internal label for your workspace."
          icon={MessageSquareMore}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connector Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="website">Website Widget</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Support Widget" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionShell>

        {connectionType === "whatsapp" && (
          <SectionShell
            title="WhatsApp / Meta"
            description="Provide Meta credentials for webhook verification and outbound messages."
            icon={LockKeyhole}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField control={form.control} name="whatsappAppId" render={({ field }) => (
                <FormItem><FormLabel>App ID</FormLabel><FormControl><Input placeholder="123456789012345" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsappPhoneNumberId" render={({ field }) => (
                <FormItem><FormLabel>Sender ID (Phone Number ID)</FormLabel><FormControl><Input placeholder="123456789012345" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsappAppSecret" render={({ field }) => (
                <FormItem><FormLabel>App Secret</FormLabel><FormControl><Input type="password" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsappAccessToken" render={({ field }) => (
                <FormItem><FormLabel>WhatsApp Access Token</FormLabel><FormControl><Input type="password" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </SectionShell>
        )}

        {connectionType === "website" && (
          <SectionShell
            title="Website Widget"
            description="Secure your widget by domain and customize core appearance settings."
            icon={Globe}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="websiteDomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Domain</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Only this domain can open widget API requests.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="widgetBubbleColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bubble Color</FormLabel>
                    <FormControl>
                      <Input placeholder="#2563eb" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="widgetFontFamily"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Font Family</FormLabel>
                    <FormControl>
                      <Input placeholder="Inter, system-ui, sans-serif" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-5">
              <FormField
                control={form.control}
                name="widgetGreeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Greeting Message</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SectionShell>
        )}

        <SectionShell
          title="Google CES Agent"
          description="Point the connector at your CES app version and service account key."
          icon={Bot}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <FormField control={form.control} name="cesAppVersion" render={({ field }) => (
              <FormItem><FormLabel>App Version</FormLabel><FormControl><Input placeholder="projects/my-project/locations/us/apps/app-id/versions/version-id" className="font-mono text-sm" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="cesDeployment" render={({ field }) => (
              <FormItem><FormLabel>Deployment (Optional)</FormLabel><FormControl><Input placeholder="projects/my-project/locations/us/apps/app-id/deployments/deployment-id" className="font-mono text-sm" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <div className="mt-5 space-y-4">
            <FormField control={form.control} name="googleAccessToken" render={({ field }) => (
              <FormItem><FormLabel>Service Account JSON</FormLabel><FormControl><Textarea placeholder={'{\n  "type": "service_account",\n  "project_id": "..."\n}'} className="min-h-48 resize-y font-mono text-sm" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <p className="font-semibold flex items-center gap-2"><Palette className="h-4 w-4" />Widget settings can be updated later from Edit Connection.</p>
            </div>
          </div>
        </SectionShell>

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row">
          <Button type="submit" disabled={isSubmitting} className="sm:min-w-40">
            {isSubmitting ? "Creating..." : "Create Connection"}
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/connections")}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
