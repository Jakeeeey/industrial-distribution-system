import { CustomerRecord, DealerNode, SubDealerNode, RetailNode, RetailDirectoryState } from "../types";

export const DEALER_CLASSIFICATION_ID = 6;
export const SUB_DEALER_CLASSIFICATION_ID = 7;
export const RETAIL_CLASSIFICATION_ID = 9;

export function buildHierarchy(customers: CustomerRecord[]): RetailDirectoryState {
  const dealersRaw = customers.filter(c => String(c.classification) === String(DEALER_CLASSIFICATION_ID) || String(c.classification).toLowerCase() === 'dealer');
  const subDealersRaw = customers.filter(c => String(c.classification) === String(SUB_DEALER_CLASSIFICATION_ID) || String(c.classification).toLowerCase() === 'sub-dealer');
  const retailRaw = customers.filter(c => String(c.classification) === String(RETAIL_CLASSIFICATION_ID) || String(c.classification).toLowerCase() === 'retail');

  const subDealers: SubDealerNode[] = subDealersRaw.map(sub => {
    return {
      ...sub,
      retailAccounts: [],
      linkedRetailCount: 0
    };
  });

  const linkedSubDealerIds = new Set<number>();

  const dealers: DealerNode[] = dealersRaw.map(dealer => {
    const dealerSubDealers = subDealers.filter(sub => {
      let parentId = null;
      if (typeof sub.otherDetails === 'string' && sub.otherDetails.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(sub.otherDetails);
          parentId = parsed.parent_dealer_id;
        } catch {}
      } else if (sub.otherDetails && typeof sub.otherDetails === 'object') {
        parentId = (sub.otherDetails as Record<string, unknown>).parent_dealer_id;
      }
      
      const isMatch = String(parentId) === String(dealer.id);
      if (isMatch) linkedSubDealerIds.add(sub.id);
      return isMatch;
    });

    return {
      ...dealer,
      subDealers: dealerSubDealers,
      linkedSubDealerCount: dealerSubDealers.length
    };
  });

  const standaloneSubDealers = subDealers.filter(sub => !linkedSubDealerIds.has(sub.id));
  const standaloneRetail: RetailNode[] = retailRaw;

  return {
    dealers,
    standaloneSubDealers,
    standaloneRetail,
    filteredCount: dealers.length + standaloneSubDealers.length + standaloneRetail.length,
    totalDealers: dealersRaw.length,
    totalSubDealers: subDealersRaw.length,
    totalRetail: retailRaw.length,
    totalActive: customers.filter(c => String(c.status).toUpperCase() === 'ACTIVE' || c.isActive === 1).length
  };
}
