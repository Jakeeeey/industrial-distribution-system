import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Brand } from "../types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BrandFormProps {
  initialValues?: Partial<Brand>;
  onSubmit: (values: Partial<Brand>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const brandSchema = z.object({
  brand_name: z.string().min(1, "Brand name is required"),
  sku_code: z.string().min(1, "SKU code is required"),
  is_industrial: z.number().optional(),
});

type BrandFormValues = z.infer<typeof brandSchema>;

export function BrandForm({
  initialValues,
  onSubmit,
  onCancel,
  isLoading
}: BrandFormProps) {
  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      brand_name: initialValues?.brand_name || "",
      sku_code: initialValues?.sku_code || "",
      is_industrial: initialValues?.is_industrial ?? 1,
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="brand_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter brand name" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sku_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU Code Prefix</FormLabel>
              <FormControl>
                <Input placeholder="BRND" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Brand"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
