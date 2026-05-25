import React, { useState } from "react";
import { ChevronRight, ChevronDown, Store, Building, Users, MapPin } from "lucide-react";
import { DealerNode, SubDealerNode, RetailNode, SelectedNode } from "../types";

interface HierarchyTreeProps {
  dealers: DealerNode[];
  standaloneSubDealers: SubDealerNode[];
  standaloneRetail: RetailNode[];
  selectedNode: SelectedNode;
  onSelectNode: (node: SelectedNode) => void;
}

function RetailItem({
  retail,
  selectedNode,
  onSelectNode,
}: {
  retail: RetailNode;
  selectedNode: SelectedNode;
  onSelectNode: (node: SelectedNode) => void;
}) {
  const isSelected = selectedNode?.id === retail.id;

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left-2 ${
        isSelected ? "bg-primary/10 text-primary font-medium shadow-xs" : "hover:bg-slate-100"
      }`}
      onClick={() => onSelectNode(retail)}
    >
      <MapPin className="w-4 h-4 text-slate-400 shrink-0 ml-6" />
      <div className="truncate text-sm flex-1">
        {retail.customer_name || "Unnamed Retail"}
      </div>
      <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
        {retail.customer_code}
      </div>
    </div>
  );
}

function SubDealerItem({
  subDealer,
  selectedNode,
  onSelectNode,
  isStandalone = false,
}: {
  subDealer: SubDealerNode;
  selectedNode: SelectedNode;
  onSelectNode: (node: SelectedNode) => void;
  isStandalone?: boolean;
}) {
  const isSelected = selectedNode?.id === subDealer.id;

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left-2 ${
        isSelected ? "bg-primary/10 text-primary font-medium shadow-xs" : "hover:bg-slate-100"
      }`}
      onClick={() => onSelectNode(subDealer)}
    >
      <Store className={`w-4 h-4 text-slate-500 shrink-0 ${isStandalone ? "" : "ml-6"}`} />
      <div className="truncate text-sm flex-1">
        {subDealer.customer_name || "Unnamed Sub-Dealer"}
      </div>
      <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
        {subDealer.customer_code}
      </div>
    </div>
  );
}

function DealerItem({
  dealer,
  selectedNode,
  onSelectNode,
}: {
  dealer: DealerNode;
  selectedNode: SelectedNode;
  onSelectNode: (node: SelectedNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedNode?.id === dealer.id;
  const hasSubDealers = dealer.subDealers && dealer.subDealers.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left-2 ${
          isSelected ? "bg-primary/10 text-primary font-medium shadow-xs" : "hover:bg-slate-100"
        }`}
        onClick={() => {
          onSelectNode(dealer);
          if (hasSubDealers && !expanded) {
            setExpanded(true);
          }
        }}
      >
        <div
          className="shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (hasSubDealers) setExpanded(!expanded);
          }}
        >
          {hasSubDealers ? (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 hover:text-slate-700" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 hover:text-slate-700" />
            )
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          )}
        </div>
        <Building className="w-4 h-4 text-slate-600 shrink-0" />
        <div className="truncate text-sm flex-1 font-medium">
          {dealer.customer_name || "Unnamed Dealer"}
        </div>
        {hasSubDealers && (
          <div className="text-[10px] text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded shrink-0 font-medium">
            {dealer.subDealers.length}
          </div>
        )}
      </div>

      {expanded && hasSubDealers && (
        <div className="ml-2 mt-1 border-l border-slate-200 pl-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-300">
          {dealer.subDealers.map((sub) => (
            <SubDealerItem
              key={sub.id}
              subDealer={sub}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyTree({ dealers, standaloneSubDealers, standaloneRetail, selectedNode, onSelectNode }: HierarchyTreeProps) {
  if ((!dealers || dealers.length === 0) && (!standaloneSubDealers || standaloneSubDealers.length === 0) && (!standaloneRetail || standaloneRetail.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Users className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm">No customers found in hierarchy.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {dealers.map((dealer) => (
        <DealerItem
          key={dealer.id}
          dealer={dealer}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
        />
      ))}
      
      {standaloneSubDealers && standaloneSubDealers.length > 0 && (
        <>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2 pl-2 border-b pb-1">
            Standalone Sub-Dealers
          </div>
          {standaloneSubDealers.map(sub => (
            <SubDealerItem 
              key={sub.id} 
              subDealer={sub} 
              selectedNode={selectedNode} 
              onSelectNode={onSelectNode} 
              isStandalone={true}
            />
          ))}
        </>
      )}

      {standaloneRetail && standaloneRetail.length > 0 && (
        <>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2 pl-2 border-b pb-1">
            Standalone Retail
          </div>
          {standaloneRetail.map(retail => (
            <div className="ml-[-1.5rem]" key={retail.id}>
               <RetailItem retail={retail} selectedNode={selectedNode} onSelectNode={onSelectNode} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
