import assert from "node:assert/strict";
import test from "node:test";

import {
  paginateReportRows,
  prepareReportRows,
} from "./report-data-table.utils.ts";

interface Row {
  id: number;
  name: string;
  quantity: number;
}

const columns = [
  { key: "name", value: (row: Row) => row.name },
  { key: "quantity", value: (row: Row) => row.quantity },
] as const;

test("searches every column without mutating the source rows", () => {
  const rows: Row[] = [
    { id: 1, name: "Alpha", quantity: 12 },
    { id: 2, name: "Beta", quantity: 7 },
  ];
  const snapshot = [...rows];

  const result = prepareReportRows(rows, columns, " 12 ", null);

  assert.deepEqual(result, [rows[0]]);
  assert.deepEqual(rows, snapshot);
  assert.notEqual(result, rows);
});

test("sorts numbers in the requested direction and keeps equal values stable", () => {
  const rows: Row[] = [
    { id: 1, name: "First", quantity: 5 },
    { id: 2, name: "Second", quantity: 9 },
    { id: 3, name: "Third", quantity: 5 },
  ];

  assert.deepEqual(
    prepareReportRows(rows, columns, "", {
      key: "quantity",
      direction: "desc",
    }).map((row) => row.id),
    [2, 1, 3],
  );
});

test("paginates immutably and clamps an out-of-range requested page", () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    name: `Row ${index + 1}`,
    quantity: index + 1,
  }));

  const result = paginateReportRows(rows, 4, 10);

  assert.equal(result.safePage, 3);
  assert.equal(result.totalPages, 3);
  assert.equal(result.firstVisibleRow, 21);
  assert.equal(result.lastVisibleRow, 21);
  assert.deepEqual(result.pageRows, [rows[20]]);
  assert.notEqual(result.pageRows, rows);
});
