"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { CompetitorPriceEntry, CompetitorRef, ProductRef } from "../types";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface CompetitorPriceListContextType {
	entries: CompetitorPriceEntry[];
	competitors: CompetitorRef[];
	products: ProductRef[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

const CompetitorPriceListContext = createContext<
	CompetitorPriceListContextType | undefined
>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

const API_BASE = "/api/ids/hrm/employee-admin/structure/competitor-price-list";

export function CompetitorPriceListFetchProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactNode {
	const [entries, setEntries] = useState<CompetitorPriceEntry[]>([]);
	const [competitors, setCompetitors] = useState<CompetitorRef[]>([]);
	const [products, setProducts] = useState<ProductRef[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		try {
			setIsLoading(true);
			setIsError(false);
			setError(null);

			// Fetch price entries + competitors list + products list in parallel
			const [entriesRes, competitorsRes, productsRes] = await Promise.all([
				fetch(API_BASE, { cache: "no-store" }),
				fetch(
					`${API_BASE}?directusCollection=competitors&fields=id,name,province,city&limit=-1`,
					{ cache: "no-store" }
				),
				fetch(
					`${API_BASE}?directusCollection=products&fields=product_id,product_name,priceA,price_per_unit&limit=-1&filter[product_brand][_eq]=40`,
					{ cache: "no-store" }
				),
			]);

			if (!entriesRes.ok) {
				throw new Error(`Failed to load price list: ${entriesRes.status}`);
			}
			if (!competitorsRes.ok) {
				throw new Error(`Failed to load competitors: ${competitorsRes.status}`);
			}
			if (!productsRes.ok) {
				throw new Error(`Failed to load products: ${productsRes.status}`);
			}

			const entriesData = await entriesRes.json();
			const competitorsData = await competitorsRes.json();
			const productsData = await productsRes.json();

			const productsList: Array<{ product_id: number; product_name: string; priceA?: number; price_per_unit?: number }> =
				Array.isArray(productsData?.data)
					? productsData.data
					: Array.isArray(productsData)
						? productsData
						: [];

			const productMap = new Map<number, { name: string; price: number }>();
			productsList.forEach((p) => {
				const ourPrice = Number(p.priceA ?? p.price_per_unit ?? 0);
				productMap.set(Number(p.product_id), { name: p.product_name, price: ourPrice });
			});

			// Coerce price to number (Directus returns decimal strings)
			const normalizedEntries: CompetitorPriceEntry[] = (
				Array.isArray(entriesData) ? entriesData : []
			).map((item: Record<string, unknown>) => {
				const product = productMap.get(Number(item.product_id));
				return {
					...item,
					price: Number(item.price ?? 0),
					product_name: product?.name,
					our_price: product?.price,
				};
			}) as CompetitorPriceEntry[];

			const competitorList: CompetitorRef[] = Array.isArray(
				competitorsData?.data
			)
				? (competitorsData.data as CompetitorRef[])
				: Array.isArray(competitorsData)
					? (competitorsData as CompetitorRef[])
					: [];

			const uniqueProducts: ProductRef[] = [];
			const seenNames = new Set<string>();
			productsList.forEach((p) => {
				const name = p.product_name?.trim();
				if (name && !seenNames.has(name)) {
					seenNames.add(name);
					uniqueProducts.push({
						product_id: p.product_id,
						product_name: name,
						priceA: p.priceA,
						price_per_unit: p.price_per_unit
					});
				}
			});

			setEntries(normalizedEntries);
			setCompetitors(competitorList);
			setProducts(uniqueProducts);
		} catch (err) {
			setIsError(true);
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	return React.createElement(
		CompetitorPriceListContext.Provider,
		{
			value: {
				entries,
				competitors,
				products,
				isLoading,
				isError,
				error,
				refetch: fetchData,
			},
		},
		children
	);
}

// ─── Context Hook ─────────────────────────────────────────────────────────────

export function useCompetitorPriceListContext(): CompetitorPriceListContextType {
	const ctx = useContext(CompetitorPriceListContext);
	if (!ctx) {
		throw new Error(
			"useCompetitorPriceListContext must be used inside CompetitorPriceListFetchProvider"
		);
	}
	return ctx;
}
