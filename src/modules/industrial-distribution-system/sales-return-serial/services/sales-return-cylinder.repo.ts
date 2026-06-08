import { directusGet, directusMutate } from "./sales-return.client";

export async function getCylinderAssetBySerial(serial: string) {
  const encoded = encodeURIComponent(serial.trim().toUpperCase());
  return directusGet<{ data: Record<string, unknown>[] }>(
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

export async function deleteCylinderAssetBySerial(serial: string) {
  const encoded = encodeURIComponent(serial.trim().toUpperCase());
  // Query to retrieve the cylinder asset ID by serial number first
  const checkRes = await directusGet<{ data: Record<string, unknown>[] }>(
    `/items/cylinder_assets?filter[serial_number][_eq]=${encoded}&fields=id&limit=1`
  );
  
  if (checkRes?.data && checkRes.data.length > 0) {
    const assetId = checkRes.data[0].id;
    // Delete the cylinder asset using its unique ID
    return directusMutate<void>(
      `/items/cylinder_assets/${assetId}`,
      "DELETE"
    );
  }
}
