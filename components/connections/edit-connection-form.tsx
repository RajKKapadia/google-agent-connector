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
import { updateConnection } from "@/lib/actions/connections";

interface EditConnectionFormProps {
  connectionId: string;
  connectionType: "whatsapp" | "website";
  defaultValues: {
    name: string;
    whatsappAppId: string;
    whatsappPhoneNumberId: string;
    cesAppVersion: string;
    cesDeployment?: string | null;
    websiteDomain?: string | null;
    widgetTitle?: string | null;
    widgetBubbleColor?: string | null;
    widgetFontFamily?: string | null;
  };
}

export function EditConnectionForm({
  connectionId,
  connectionType,
  defaultValues,
}: EditConnectionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editSchema = z
    .object({
      name: z.string().min(1, "Name is required").max(100),
      whatsappAppId: z.string().optional(),
      whatsappAppSecret: z.string().optional(),
      whatsappPhoneNumberId: z.string().optional(),
      whatsappAccessToken: z.string().optional(),
      websiteDomain: z.string().optional(),
      widgetTitle: z.string().optional(),
      widgetBubbleColor: z.string().optional(),
      widgetFontFamily: z.string().optional(),
      cesAppVersion: z
        .string()
        .min(1, "App Version is required")
        .refine(
          (s) => s.includes("/versions/"),
          "Must be a full app version path (e.g. projects/.../versions/...)"
        ),
      cesDeployment: z.string().optional(),
      googleAccessToken: z
        .string()
        .optional()
        .refine((s) => {
          if (!s || s.trim() === "") return true;
          try {
            const parsed = JSON.parse(s.trim());
            return parsed.type === "service_account";
          } catch {
            return false;
          }
        }, "Must be valid service account JSON (type: service_account)"),
    })
    .superRefine((data, ctx) => {
      if (connectionType === "whatsapp") {
        if (!data.whatsappAppId?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["whatsappAppId"],
            message: "Meta App ID is required",
          });
        }
        if (!data.whatsappPhoneNumberId?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["whatsappPhoneNumberId"],
            message: "Sender ID is required",
          });
        }
      }

      if (connectionType === "website") {
        if (!data.websiteDomain?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["websiteDomain"],
            message: "Website domain is required",
          });
        }
        if (!data.widgetTitle?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["widgetTitle"],
            message: "Widget title is required",
          });
        }
      }
    });

  type EditFormValues = z.infer<typeof editSchema>;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: defaultValues.name,
      whatsappAppId: defaultValues.whatsappAppId,
      whatsappAppSecret: "",
      whatsappPhoneNumberId: defaultValues.whatsappPhoneNumberId,
      whatsappAccessToken: "",
      websiteDomain: defaultValues.websiteDomain ?? "",
      widgetTitle: defaultValues.widgetTitle ?? "",
      widgetBubbleColor: defaultValues.widgetBubbleColor ?? "#2563eb",
      widgetFontFamily:
        defaultValues.widgetFontFamily ?? "Inter, system-ui, sans-serif",
      cesAppVersion: defaultValues.cesAppVersion,
      cesDeployment: defaultValues.cesDeployment ?? "",
      googleAccessToken: "",
    },
  });

  async function onSubmit(values: EditFormValues) {
    setIsSubmitting(true);
    try {
      // Only send sensitive fields if the user actually typed something
      const payload: Parameters<typeof updateConnection>[1] = {
        name: values.name,
        cesAppVersion: values.cesAppVersion,
        cesDeployment: values.cesDeployment || undefined,
      };

      if (connectionType === "whatsapp") {
        payload.whatsappAppId = values.whatsappAppId?.trim();
        payload.whatsappPhoneNumberId = values.whatsappPhoneNumberId?.trim();

        if (values.whatsappAppSecret?.trim()) {
          payload.whatsappAppSecret = values.whatsappAppSecret.trim();
        }
        if (values.whatsappAccessToken?.trim()) {
          payload.whatsappAccessToken = values.whatsappAccessToken.trim();
        }
      }

      if (connectionType === "website") {
        payload.websiteDomain = values.websiteDomain?.trim() || undefined;
        payload.widgetTitle = values.widgetTitle?.trim() || undefined;
        payload.widgetBubbleColor = values.widgetBubbleColor?.trim() || undefined;
        payload.widgetFontFamily = values.widgetFontFamily?.trim() || undefined;
      }

      if (values.googleAccessToken?.trim()) {
        payload.googleAccessToken = values.googleAccessToken.trim();
      }

      const result = await updateConnection(connectionId, payload);
      if (result.success) {
        toast.success("Connection updated successfully!");
        router.push(`/connections/${connectionId}`);
      } else {
        toast.error(result.error);
        if (result.fieldErrors) {
          for (const [field, errors] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof EditFormValues, {
              message: errors[0],
            });
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
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {connectionType === "whatsapp" ? (
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
                      <Input className="font-mono" {...field} />
                    </FormControl>
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
                        placeholder="Leave blank to keep unchanged"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Only fill this to replace the stored secret.
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
                      <Input className="font-mono" {...field} />
                    </FormControl>
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
                        placeholder="Leave blank to keep unchanged"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Only fill this to replace the stored token.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>
        ) : (
          <section>
            <h3 className="text-lg font-semibold mb-4">Website Widget</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="widgetTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Widget Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Realty Co." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="websiteDomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Site(s)</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com, localhost:8000" {...field} />
                    </FormControl>
                    <FormDescription>
                      Separate multiple entries with commas.
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
                      <Input className="font-mono" {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>
        )}

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
                      placeholder="Leave blank to keep unchanged. Paste new service account JSON to replace."
                      className="font-mono text-sm min-h-25 resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Only paste new JSON to replace the stored credentials.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex gap-4 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/connections/${connectionId}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
