import { directusGet, directusMutate } from "./sales-return.client";

export async function getCylinderAssetBySerial(serial: string) {
  const encoded = encodeURIComponent(serial.trim().toUpperCase());
  return directusGet<{ data: any[] }>(
    `/items/cylinder_assets?filter[serial_number][_eq]=${encoded}&limit=1`
  );
}

export async function createCylinderAsset(payload: Record<string, unknown>) {
  return directusMutate<{ data: Record<string, unknown> }>(
    "/items/cylinder_assets",
    "POST",
    payload
  );
}
