import Joi from 'joi';
import { PipelineStage } from 'mongoose';
import { OrderStatus } from '../../models/order.model';

// Optional single-year filter for the monthly-trends graph (default: this year).
export const trendsQuerySchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
});

export type StatusCounts = Record<string, number>;

// Every order status initialised to 0 so the response shape is always stable.
export const emptyOrderStatusCounts = (): StatusCounts =>
  Object.values(OrderStatus).reduce<StatusCounts>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

// Group orders by status → { _id: <status>, count } rows.
export const orderStatusPipeline = (): PipelineStage[] => [
  { $group: { _id: '$status', count: { $sum: 1 } } },
];

type MonthlyRow = { _id: { year: number; month: number }; count: number };

/**
 * Group a timestamped collection by calendar month within a single `year`.
 */
export const monthlyPipeline = (year: number): PipelineStage[] => [
  {
    $match: {
      createdAt: {
        $gte: new Date(Date.UTC(year, 0, 1)),
        $lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  },
  {
    $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      count: { $sum: 1 },
    },
  },
];

/**
 * Last month to include for `year`: the current month when `year` is the current
 * year (Jan…current month), otherwise December (a past/other year shows all 12).
 */
export const lastMonthFor = (year: number, now: Date = new Date()): number =>
  year === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 12;

// [1, 2, …, lastMonth] — the month axis for the graph.
export const monthRange = (lastMonth: number): number[] =>
  Array.from({ length: lastMonth }, (_, index) => index + 1);

/**
 * Turn sparse grouped rows into a dense count array aligned to months
 * [1..lastMonth], with 0 for any month that has no data — ready to plot.
 */
export const denseCounts = (rows: MonthlyRow[], lastMonth: number): number[] => {
  const byMonth = new Map<number, number>();
  for (const row of rows) byMonth.set(row._id.month, row.count);
  return monthRange(lastMonth).map((month) => byMonth.get(month) ?? 0);
};
