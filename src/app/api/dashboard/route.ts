import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export interface DashboardSalesKpi {
  totalSales:  number;
  paidSales:   number;
  unpaidSales: number;
  salesCount:  number;
}

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(price), 0)                                    AS totalSales,
        COALESCE(SUM(CASE WHEN paid = 1 THEN price ELSE 0 END), 0) AS paidSales,
        COALESCE(SUM(CASE WHEN paid = 0 THEN price ELSE 0 END), 0) AS unpaidSales,
        COUNT(*)                                                    AS salesCount
      FROM appraisals
    `).get() as DashboardSalesKpi;

    return NextResponse.json(row);
  } catch (e) {
    console.error("[GET /api/dashboard]", e);
    return NextResponse.json(
      { totalSales: 0, paidSales: 0, unpaidSales: 0, salesCount: 0 } satisfies DashboardSalesKpi,
      { status: 500 },
    );
  }
}
