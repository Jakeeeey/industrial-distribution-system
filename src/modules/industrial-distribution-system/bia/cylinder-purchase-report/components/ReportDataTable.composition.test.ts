import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSource = readFileSync(
  new URL("./ReportDataTable.tsx", import.meta.url),
  "utf8",
);
const searchSource = readFileSync(
  new URL("./ReportTableSearch.tsx", import.meta.url),
  "utf8",
);

const analyticalViewSources = [
  "CustomerRankingView.tsx",
  "ProductPerformanceView.tsx",
  "ReturnAnalysisView.tsx",
  "BranchPerformanceView.tsx",
  "SalespersonPerformanceView.tsx",
  "CustomerPurchaseDetail.tsx",
].map((filename) => ({
  filename,
  source: readFileSync(new URL(`./${filename}`, import.meta.url), "utf8"),
}));

test("the shared table owns one accessible controlled search input", () => {
  assert.match(componentSource, /searchLabel:\s*string/);
  assert.match(componentSource, /searchPlaceholder\?:\s*string/);
  assert.doesNotMatch(componentSource, /searchText\?:\s*string/);
  assert.match(
    componentSource,
    /const\s+\[searchText,\s*setSearchText\]\s*=\s*React\.useState\(""\)/,
  );
  assert.match(componentSource, /<ReportTableSearch/);
  assert.match(componentSource, /value=\{searchText\}/);
  assert.match(componentSource, /onValueChange=\{setSearchText\}/);
  assert.match(searchSource, /const inputId = React\.useId\(\)/);
  assert.match(
    searchSource,
    /<Label[\s\S]*htmlFor=\{inputId\}[\s\S]*\{label\}[\s\S]*<\/Label>/,
  );
  assert.match(
    searchSource,
    /<Input[\s\S]*type="search"[\s\S]*value=\{value\}[\s\S]*onValueChange\(event\.target\.value\)/,
  );
  assert.match(
    componentSource,
    /\[rows,\s*searchText,\s*sortKey,\s*sortDirection,\s*tableResetKey\]/,
  );
});

test("every analytical and detail table receives its search contract from the shared component", () => {
  for (const { filename, source } of analyticalViewSources) {
    const tableCount = source.match(/<ReportDataTable\b/g)?.length ?? 0;
    const searchContractCount = source.match(/\bsearchLabel=/g)?.length ?? 0;

    assert.ok(tableCount > 0, `${filename} must render a report table`);
    assert.equal(
      searchContractCount,
      tableCount,
      `${filename} must label every shared table search`,
    );
  }
});

test("the shared table stays below the component architecture guardrail", () => {
  assert.ok(
    componentSource.split(/\r?\n/).length <= 300,
    "ReportDataTable.tsx must stay at or below 300 lines",
  );
});
