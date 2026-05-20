import React from "react";
import { SelectedNode, DealerNode, SubDealerNode } from "../types";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Building,
  Store,
  Map,
  Tag,
  Hash,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerDetailsPanelProps {
  node: SelectedNode;
  classificationsMeta: Record<string, string>;
  storeTypesMeta: Record<string, string>;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 bg-slate-100 p-1.5 rounded-md text-slate-500">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className="text-sm font-medium text-slate-900">
          {value || <span className="text-slate-400 italic">Not specified</span>}
        </div>
      </div>
    </div>
  );
}

export function CustomerDetailsPanel({ node, classificationsMeta, storeTypesMeta }: CustomerDetailsPanelProps) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
        <Store className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium text-slate-500">No Selection</p>
        <p className="text-sm">Select a dealer or sub-dealer from the hierarchy tree to view details.</p>
      </div>
    );
  }

  const isDealer = "subDealers" in node;
  const isSubDealer = "retailAccounts" in node;

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-2 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={isDealer ? "default" : "secondary"}
              className={`uppercase tracking-wider text-[10px] ${
                isDealer ? "bg-blue-600 hover:bg-blue-700" : ""
              }`}
            >
              {isDealer ? "Dealer" : isSubDealer ? "Sub-Dealer" : "Retail"}
            </Badge>
            <Badge
              variant="outline"
              className={
                String(node.status).toUpperCase() === "ACTIVE"
                  ? "border-green-500 text-green-600 bg-green-50"
                  : "border-slate-300 text-slate-500 bg-slate-50"
              }
            >
              {node.status || "UNKNOWN"}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {node.customer_name}
          </h2>
          <div className="text-sm text-slate-500 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" /> {node.customer_code}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card className="shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-0 fill-mode-both">
          
          <CardHeader className=" px-4 bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
              <Building className="w-4 h-4" /> Basic Information
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-4 flex flex-col gap-1">
            <DetailRow icon={Tag} label="Store Signage" value={node.store_signage} />
            <DetailRow icon={Store} label="Store Type" value={storeTypesMeta[String(node.store_type)] || node.store_type} />
            <DetailRow icon={Building} label="Classification" value={classificationsMeta[String(node.classification)] || node.classification} />
          </CardContent>
          
        </Card>

        <Card className="shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          <CardHeader className=" px-4 bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
              <Phone className="w-4 h-4" /> Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-1">
            <DetailRow icon={Phone} label="Mobile Number" value={node.contact_number} />
            <DetailRow icon={Mail} label="Email Address" value={node.customer_email} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
          <CardHeader className=" px-4 bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4" /> Address Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-1">
            <DetailRow
              icon={Map}
              label="Location"
              value={[node.brgy, node.city, node.province].filter(Boolean).join(", ")}
            />
            {(node.latitude || node.longitude) && (
              <DetailRow
                icon={MapPin}
                label="Geo Tag"
                value={`${node.latitude || "N/A"}, ${node.longitude || "N/A"}`}
              />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
          <CardHeader className=" px-4 bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
              <CreditCard className="w-4 h-4" /> Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-1">
            <DetailRow icon={CreditCard} label="Payment Term" value={`${node.payment_term} days`} />
            <DetailRow icon={Tag} label="Price Type" value={node.price_type} />
            <DetailRow icon={Hash} label="TIN" value={node.customer_tin} />
            <DetailRow
              icon={Building}
              label="Tax Status"
              value={`VAT: ${node.isVAT ? "Yes" : "No"} | EWT: ${node.isEWT ? "Yes" : "No"}`}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/50 bg-slate-50/30">
        <CardHeader className="px-4 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
            <Users className="w-4 h-4" /> Relationship Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex flex-col gap-1">
          {isDealer && (
            <DetailRow
              icon={Store}
              label="Linked Sub-Dealers"
              value={(node as DealerNode).subDealers?.length || 0}
            />
          )}
          {isSubDealer && (
            <DetailRow
              icon={Building}
              label="Parent Dealer ID"
              value={(() => {
                const sub = node as SubDealerNode;
                let parentId = null;
                if (typeof sub.otherDetails === "string" && sub.otherDetails.trim().startsWith("{")) {
                  try {
                    const parsed = JSON.parse(sub.otherDetails);
                    parentId = parsed.parent_dealer_id;
                  } catch {}
                } else if (sub.otherDetails && typeof sub.otherDetails === "object") {
                  parentId = (sub.otherDetails as Record<string, unknown>).parent_dealer_id;
                }
                return parentId || "None";
              })()}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


