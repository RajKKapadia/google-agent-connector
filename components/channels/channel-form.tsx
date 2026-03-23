"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createChannel, updateChannel } from "@/lib/actions/channels";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  whatsappAppId: z.string().optional(),
  whatsappAppSecret: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  websiteDomain: z.string().optional(),
  widgetTitle: z.string().optional(),
  widgetBubbleColor: z.string().optional(),
  widgetFontFamily: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ChannelFormProps {
  mode: "create" | "edit";
  channelId?: string;
  channelType: "whatsapp" | "website";
  initialValues?: FormValues;
}

export function ChannelForm({
  mode,
  channelId,
  channelType,
  initialValues,
}: ChannelFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      initialValues ??
      (channelType === "whatsapp"
        ? {
            name: "",
            whatsappAppId: "",
            whatsappAppSecret: "",
            whatsappPhoneNumberId: "",
            whatsappAccessToken: "",
          }
        : {
            name: "",
            websiteDomain: "",
            widgetTitle: "",
            widgetBubbleColor: "#2563eb",
            widgetFontFamily: "system-ui, sans-serif",
          }),
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const payload = {
        type: channelType,
        ...values,
      };
      const result =
        mode === "create"
          ? await createChannel(payload)
          : await updateChannel(channelId!, payload);

      if (result.success) {
        const targetId = mode === "create" ? result.data?.id : channelId;
        router.push(`/channels/${targetId}`);
        router.refresh();
        return;
      }

      toast.error(result.error);
      if (result.fieldErrors) {
        for (const [field, errors] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof FormValues, { message: errors[0] });
        }
      }
    } catch {
      toast.error(mode === "create" ? "Failed to create channel" : "Failed to update channel");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Channel Name</FormLabel>
              <FormControl>
                <Input placeholder={channelType === "whatsapp" ? "WhatsApp Support" : "Website Widget"} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {channelType === "whatsapp" ? (
          <>
            <FormField
              control={form.control}
              name="whatsappAppId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta App ID</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="123456789012345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="whatsappPhoneNumberId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number ID</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="123456789012345" {...field} />
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
                  <FormLabel>Meta App Secret</FormLabel>
                  <FormControl>
                    <Input type="password" className="font-mono" {...field} />
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
                    <Input type="password" className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name="widgetTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Widget Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Support" {...field} />
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
                    <Input placeholder="example.com, app.example.com" {...field} />
                  </FormControl>
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
                    <Input className="font-mono" placeholder="#2563eb" {...field} />
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
                    <Input placeholder="system-ui, sans-serif" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Channel"
                : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
