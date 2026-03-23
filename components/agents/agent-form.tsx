"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createAgent, updateAgent } from "@/lib/actions/agents";
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
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cesAppVersion: z
    .string()
    .min(1, "CES app version is required")
    .refine((value) => value.includes("/versions/"), "Must be a full app version path"),
  cesDeployment: z.string().optional(),
  googleServiceAccount: z.string().min(1, "Service account JSON is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: string;
  initialValues?: FormValues;
}

export function AgentForm({ mode, agentId, initialValues }: AgentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? {
      name: "",
      cesAppVersion: "",
      cesDeployment: "",
      googleServiceAccount: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result =
        mode === "create"
          ? await createAgent(values)
          : await updateAgent(agentId!, values);

      if (result.success) {
        const targetId = mode === "create" ? result.data?.id : agentId;
        router.push(`/agents/${targetId}`);
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
      toast.error(mode === "create" ? "Failed to create agent" : "Failed to update agent");
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
              <FormLabel>Agent Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Support Agent" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cesAppVersion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CES App Version</FormLabel>
              <FormControl>
                <Input className="font-mono text-sm" placeholder="projects/my-project/locations/us/apps/app-id/versions/version-id" {...field} />
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
              <FormLabel>CES Deployment</FormLabel>
              <FormControl>
                <Input className="font-mono text-sm" placeholder="projects/my-project/locations/us/apps/app-id/deployments/deployment-id" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="googleServiceAccount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Account JSON</FormLabel>
              <FormControl>
                <Textarea className="min-h-56 resize-y font-mono text-sm" placeholder={'{\n  "type": "service_account"\n}'} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Agent"
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
