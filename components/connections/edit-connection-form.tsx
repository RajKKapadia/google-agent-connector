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

// All fields optional — only non-empty values are sent to the server
const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  whatsappAppId: z.string().min(1, "Meta App ID is required"),
  whatsappAppSecret: z.string().optional(),
  whatsappPhoneNumberId: z.string().min(1, "Sender ID is required"),
  whatsappAccessToken: z.string().optional(),
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
      if (!s || s.trim() === "") return true; // blank = keep existing
      try {
        const parsed = JSON.parse(s.trim());
        return parsed.type === "service_account";
      } catch {
        return false;
      }
    }, "Must be valid service account JSON (type: service_account)"),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditConnectionFormProps {
  connectionId: string;
  defaultValues: {
    name: string;
    whatsappAppId: string;
    whatsappPhoneNumberId: string;
    cesAppVersion: string;
    cesDeployment?: string | null;
  };
}

export function EditConnectionForm({
  connectionId,
  defaultValues,
}: EditConnectionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: defaultValues.name,
      whatsappAppId: defaultValues.whatsappAppId,
      whatsappAppSecret: "",
      whatsappPhoneNumberId: defaultValues.whatsappPhoneNumberId,
      whatsappAccessToken: "",
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
        whatsappAppId: values.whatsappAppId,
        whatsappPhoneNumberId: values.whatsappPhoneNumberId,
        cesAppVersion: values.cesAppVersion,
        cesDeployment: values.cesDeployment || undefined,
      };

      if (values.whatsappAppSecret?.trim()) {
        payload.whatsappAppSecret = values.whatsappAppSecret.trim();
      }
      if (values.whatsappAccessToken?.trim()) {
        payload.whatsappAccessToken = values.whatsappAccessToken.trim();
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
