// src/modules/.../inventory-control/utils/grouping.ts

import type {
  CategoryGroup,
  CategoryInfo,
  EnrichedSerial,
  InventorySummary,
  ProductGroup,
  ProductInfo,
  SerialOnhandRecord,
} from "../type";

/** Treat anything not exactly "Full" (case-insensitive) as empty */
export function isFullStatus(status: string): boolean {
  return status?.trim().toLowerCase() === "full";
}

/** Enrich flat serial records with product name, category name, barcode */
export function enrichSerials(
  records: SerialOnhandRecord[],
  products: ProductInfo[],
  categories: CategoryInfo[],
): EnrichedSerial[] {
  const productMap = new Map<number, ProductInfo>();
  for (const p of products) productMap.set(p.product_id, p);

  const categoryMap = new Map<number, CategoryInfo>();
  for (const c of categories) categoryMap.set(c.category_id, c);

  // Only return serials that have a matching product to ensure we only show
  // serials that are actually in our product catalog.
  return records
    .filter((rec) => productMap.has(rec.productId))
    .map((rec) => {
      const product = productMap.get(rec.productId)!;
      const categoryId = product.product_category ?? null;
      const category =
        categoryId !== null ? categoryMap.get(categoryId) : undefined;

      // Determine parent id: prefer the serial's parentId if present, otherwise
      // fall back to the product's parent_id field.
      const parentIdFromRec =
        rec.parentId && rec.parentId > 0
          ? rec.parentId
          : product.parent_id && product.parent_id > 0
            ? product.parent_id
            : null;

      const parentProduct =
        parentIdFromRec !== null ? productMap.get(parentIdFromRec) : undefined;

      return {
        ...rec,
        productName: product.product_name,
        categoryName: category?.category_name ?? "Uncategorized",
        barcode: product.barcode ?? null,
        isFull: isFullStatus(rec.status),
        parentName: parentProduct?.product_name ?? null,
      };
    });
}

/** Group enriched serials into CategoryGroup → ProductGroup hierarchy */
export function groupByCategory(enriched: EnrichedSerial[]): CategoryGroup[] {
  // Group by parent_id when available, otherwise by productId. Use parentName
  // (if present) as the display name so related SKUs are shown together.
  const productMap = new Map<string, ProductGroup>();

  for (const serial of enriched) {
    const categoryNameClean = (serial.categoryName || "").trim();

    const groupingId =
      serial.parentId && serial.parentId > 0
        ? serial.parentId
        : serial.productId;
    const groupName =
      serial.parentId && serial.parentId > 0
        ? serial.parentName || `Parent #${serial.parentId}`
        : serial.productName || `Product #${serial.productId}`;

    const key = `${categoryNameClean.toLowerCase()}::ID-${groupingId}`;

    let group = productMap.get(key);

    if (!group) {
      group = {
        productId: groupingId,
        productName: groupName.trim(),
        categoryName: categoryNameClean,
        barcode: serial.barcode,
        fullCount: 0,
        emptyCount: 0,
        totalCount: 0,
        serials: [],
      };
      productMap.set(key, group);
    }

    // Keep the barcode if a non-null barcode is found later
    if (!group.barcode && serial.barcode) {
      group.barcode = serial.barcode;
    }

    if (serial.isFull) {
      group.fullCount++;
    } else {
      group.emptyCount++;
    }
    group.totalCount++;
    group.serials.push(serial);
  }

  // Group products by category
  const categoryMap = new Map<string, ProductGroup[]>();

  for (const product of productMap.values()) {
    const cat = product.categoryName;
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(product);
  }

  // Build CategoryGroup array, sorted by category name
  const result: CategoryGroup[] = [];

  for (const [categoryName, products] of categoryMap.entries()) {
    // Sort products by name within category
    const sortedProducts = [...products].sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );

    const totalFull = sortedProducts.reduce((s, p) => s + p.fullCount, 0);
    const totalEmpty = sortedProducts.reduce((s, p) => s + p.emptyCount, 0);
    const totalCount = sortedProducts.reduce((s, p) => s + p.totalCount, 0);

    result.push({
      categoryName,
      products: sortedProducts,
      totalFull,
      totalEmpty,
      totalCount,
    });
  }

  return result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

/** Compute summary KPIs from category groups */
export function computeSummary(groups: CategoryGroup[]): InventorySummary {
  let totalProducts = 0;
  let totalFull = 0;
  let totalEmpty = 0;

  for (const cat of groups) {
    totalProducts += cat.products.length;
    totalFull += cat.totalFull;
    totalEmpty += cat.totalEmpty;
  }

  return {
    totalProducts,
    totalFull,
    totalEmpty,
    grandTotal: totalFull + totalEmpty,
  };
}
