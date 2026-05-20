import { CustomerMetrics } from "../types";

export function calculateFulfillmentScore(metrics: CustomerMetrics): number {
  if (metrics.totalOrdered === 0 && metrics.totalDeliveries === 0) return 0;
  
  const volumeEfficiency = metrics.totalOrdered > 0 
    ? (metrics.totalDelivered / metrics.totalOrdered) * 0.7 
    : 0;
    
  const timelinessEfficiency = metrics.totalDeliveries > 0 
    ? (metrics.onTimeDeliveries / metrics.totalDeliveries) * 0.3 
    : 0;

  return (volumeEfficiency + timelinessEfficiency) * 100;
}

export function calculateMissingEmpties(metrics: CustomerMetrics): number {
  return metrics.cumulativeDeployed - metrics.cumulativeReturned;
}

export function formatPHP(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}
