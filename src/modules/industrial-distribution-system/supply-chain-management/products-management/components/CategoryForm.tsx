import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Category } from "../types";
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

interface CategoryFormProps {
  initialValues?: Partial<Category>;
  onSubmit: (values: Partial<Category>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const categorySchema = z.object({
  category_name: z.string().min(1, "Category name is required"),
  sku_code: z.string().min(1, "SKU code is required"),
  is_industrial: z.number().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export function CategoryForm({
  initialValues,
  onSubmit,
  onCancel,
  isLoading
}: CategoryFormProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      category_name: initialValues?.category_name || "",
      sku_code: initialValues?.sku_code || "",
      is_industrial: initialValues?.is_industrial ?? 1,
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="category_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter category name" {...field} value={field.value ?? ""} />
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
                <Input placeholder="CAT" {...field} value={field.value ?? ""} />
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
            {isLoading ? "Saving..." : "Save Category"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
