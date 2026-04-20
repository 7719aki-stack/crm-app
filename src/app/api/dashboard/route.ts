import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export interface DashboardSalesKpi {
  totalSales:  number;
  paidSales:   number;
  unpaidSales: number;
  salesCount:  number;
}

export interface UrgentCustomer {
  id:          number;
  name:        string;
  next_action: string | null;
}

export interface DashboardResponse {
  salesKpi:         DashboardSalesKpi;
  urgentCustomers:  UrgentCustomer[];
}

export async function GET() {
  const fallback: DashboardResponse = {
    salesKpi:        { totalSales: 0, paidSales: 0, unpaidSales: 0, salesCount: 0 },
    urgentCustomers: [],
  };

  try {
    const db = getDb();

    const salesKpi = db.prepare(`
      SELECT
        COALESCE(SUM(price), 0)                                    AS totalSales,
        COALESCE(SUM(CASE WHEN paid = 1 THEN price ELSE 0 END), 0) AS paidSales,
        COALESCE(SUM(CASE WHEN paid = 0 THEN price ELSE 0 END), 0) AS unpaidSales,
        COUNT(*)                                                    AS salesCount
      FROM appraisals
    `).get() as DashboardSalesKpi;

    const urgentCustomers = db.prepare(`
      SELECT
        id,
        name,
        next_action
      FROM customers
      WHERE
        next_action IS NULL
        OR next_action <= date('now')
      ORDER BY next_action ASC
      LIMIT 5
    `).all() as UrgentCustomer[];

    return NextResponse.json({ salesKpi, urgentCustomers } satisfies DashboardResponse);
  } catch (e) {
    console.error("[GET /api/dashboard]", e);
    return NextResponse.json(fallback, { status: 500 });
  }
}
