import { computePricing } from '../../../src/utils/pricing.js';
import { getBootstrapData } from '../bootstrap/service.js';

export interface ChartConfig {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: { name: string; value: number; value2?: number }[];
  xLabel?: string;
  yLabel?: string;
}

export interface ToolResult {
  content: string;
  chart?: ChartConfig;
}

// ─── Tool definitions (OpenAI-compatible format) ──────────────────────────────

export const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_inventory_summary',
      description:
        'Get a high-level summary of the vehicle inventory: total count, average price, and breakdowns by make, fuel, transmission, status, and price position (above/in/below market).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_vehicles',
      description:
        'Search and filter vehicles from the live inventory. Returns matching vehicles with their current price, suggested target, and market position.',
      parameters: {
        type: 'object',
        properties: {
          make: { type: 'string', description: 'Filter by make (e.g. BMW, Toyota, Volkswagen)' },
          model: { type: 'string', description: 'Filter by model (partial match, e.g. "3 Series")' },
          year_from: { type: 'number', description: 'Minimum year (inclusive)' },
          year_to: { type: 'number', description: 'Maximum year (inclusive)' },
          fuel: { type: 'string', description: 'Petrol, Diesel, or Hybrid' },
          transmission: { type: 'string', description: 'Manual or Automatic' },
          price_min: { type: 'number', description: 'Minimum current price in EUR' },
          price_max: { type: 'number', description: 'Maximum current price in EUR' },
          price_position: {
            type: 'string',
            enum: ['above_market', 'in_market', 'below_market'],
            description: 'Filter by market position',
          },
          sort_by: {
            type: 'string',
            enum: ['price_asc', 'price_desc', 'year_desc', 'mileage_asc', 'days_in_stock_desc'],
          },
          limit: { type: 'number', description: 'Max results to return (default 20, max 50)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pricing_analysis',
      description:
        'Get pricing analysis with market position stats. Optionally filter by make or group by a dimension (make, fuel, transmission, year, body_type) to get per-group breakdowns.',
      parameters: {
        type: 'object',
        properties: {
          make: { type: 'string', description: 'Restrict analysis to a specific make' },
          group_by: {
            type: 'string',
            enum: ['make', 'fuel', 'transmission', 'year', 'body_type'],
            description: 'Group results by this dimension',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_chart',
      description:
        'Render a bar, pie, or line chart to visualise data. Call this after gathering data to produce a visual for the user.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['bar', 'pie', 'line'] },
          title: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
                value2: { type: 'number', description: 'Optional second series' },
              },
              required: ['name', 'value'],
            },
          },
          x_label: { type: 'string' },
          y_label: { type: 'string' },
        },
        required: ['type', 'title', 'data'],
      },
    },
  },
];

// ─── Tool executors ────────────────────────────────────────────────────────────

function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

export async function executeTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const bootstrap = await getBootstrapData(userId);
  const { vehicles, comparableListings, pricingDecisions, excludedComparables } = bootstrap;

  // Pre-compute pricing for all vehicles once
  const vehiclePricing = vehicles.map((vehicle) => {
    const comps = comparableListings.filter((l) => l.vehicleId === vehicle.id);
    const excluded = excludedComparables[vehicle.id] ?? [];
    const decision = pricingDecisions[vehicle.id];
    const pricing = computePricing(vehicle, comps, excluded, decision);
    return { vehicle, pricing };
  });

  switch (toolName) {
    case 'get_inventory_summary': {
      const total = vehicles.length;
      const byMake = countBy(vehicles, (v) => v.make);
      const byFuel = countBy(vehicles, (v) => v.fuel);
      const byTransmission = countBy(vehicles, (v) => v.transmission);
      const byStatus = countBy(vehicles, (v) => v.status);
      const above = vehiclePricing.filter((vp) => vp.pricing.currentPosition === 'above_market').length;
      const below = vehiclePricing.filter((vp) => vp.pricing.currentPosition === 'below_market').length;
      const inMarket = vehiclePricing.filter((vp) => vp.pricing.currentPosition === 'in_market').length;
      const noData = vehiclePricing.filter((vp) => vp.pricing.currentPosition === null).length;
      const avgPrice = Math.round(vehicles.reduce((acc, v) => acc + v.price, 0) / total);

      return {
        content: JSON.stringify(
          {
            total_vehicles: total,
            average_price_eur: avgPrice,
            by_make: byMake,
            by_fuel: byFuel,
            by_transmission: byTransmission,
            by_status: byStatus,
            price_position: { above_market: above, in_market: inMarket, below_market: below, no_pricing_data: noData },
          },
          null,
          2,
        ),
      };
    }

    case 'search_vehicles': {
      const args = toolArgs as {
        make?: string;
        model?: string;
        year_from?: number;
        year_to?: number;
        fuel?: string;
        transmission?: string;
        price_min?: number;
        price_max?: number;
        price_position?: string;
        sort_by?: string;
        limit?: number;
      };
      const limit = Math.min(args.limit ?? 20, 50);

      let results = vehiclePricing.filter(({ vehicle, pricing }) => {
        if (args.make && vehicle.make.toLowerCase() !== args.make.toLowerCase()) return false;
        if (args.model && !vehicle.model.toLowerCase().includes(args.model.toLowerCase())) return false;
        if (args.year_from !== undefined && vehicle.year < args.year_from) return false;
        if (args.year_to !== undefined && vehicle.year > args.year_to) return false;
        if (args.fuel && vehicle.fuel.toLowerCase() !== args.fuel.toLowerCase()) return false;
        if (args.transmission && vehicle.transmission.toLowerCase() !== args.transmission.toLowerCase()) return false;
        if (args.price_min !== undefined && vehicle.price < args.price_min) return false;
        if (args.price_max !== undefined && vehicle.price > args.price_max) return false;
        if (args.price_position && pricing.currentPosition !== args.price_position) return false;
        return true;
      });

      if (args.sort_by) {
        results = [...results].sort((a, b) => {
          switch (args.sort_by) {
            case 'price_asc': return a.vehicle.price - b.vehicle.price;
            case 'price_desc': return b.vehicle.price - a.vehicle.price;
            case 'year_desc': return b.vehicle.year - a.vehicle.year;
            case 'mileage_asc': return a.vehicle.mileageKm - b.vehicle.mileageKm;
            case 'days_in_stock_desc':
              return new Date(a.vehicle.dateAdded).getTime() - new Date(b.vehicle.dateAdded).getTime();
            default: return 0;
          }
        });
      }

      const sliced = results.slice(0, limit).map(({ vehicle, pricing }) => ({
        id: vehicle.id,
        stockId: vehicle.stockId,
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant,
        year: vehicle.year,
        mileageKm: vehicle.mileageKm,
        fuel: vehicle.fuel,
        transmission: vehicle.transmission,
        currentPrice: vehicle.price,
        suggestedTarget: pricing.suggestedTarget,
        pricePosition: pricing.currentPosition,
        comparableCount: pricing.comparableCount,
        dateAdded: vehicle.dateAdded,
      }));

      return {
        content: JSON.stringify({ total_matches: results.length, returned: sliced.length, vehicles: sliced }, null, 2),
      };
    }

    case 'get_pricing_analysis': {
      const args = toolArgs as { make?: string; group_by?: string };
      let filtered = vehiclePricing;

      if (args.make) {
        filtered = filtered.filter(({ vehicle }) => vehicle.make.toLowerCase() === args.make!.toLowerCase());
      }

      if (args.group_by) {
        type GroupStats = { above: number; in_market: number; below: number; no_data: number; avg_price: number; count: number };
        const groups: Record<string, GroupStats> = {};

        for (const { vehicle, pricing } of filtered) {
          const groupKey =
            args.group_by === 'body_type' ? vehicle.bodyType :
            args.group_by === 'fuel' ? vehicle.fuel :
            args.group_by === 'transmission' ? vehicle.transmission :
            args.group_by === 'year' ? String(vehicle.year) :
            vehicle.make;

          if (!groups[groupKey]) {
            groups[groupKey] = { above: 0, in_market: 0, below: 0, no_data: 0, avg_price: 0, count: 0 };
          }
          groups[groupKey].count++;
          groups[groupKey].avg_price += vehicle.price;
          if (pricing.currentPosition === 'above_market') groups[groupKey].above++;
          else if (pricing.currentPosition === 'in_market') groups[groupKey].in_market++;
          else if (pricing.currentPosition === 'below_market') groups[groupKey].below++;
          else groups[groupKey].no_data++;
        }

        for (const g of Object.values(groups)) {
          g.avg_price = Math.round(g.avg_price / g.count);
        }

        return { content: JSON.stringify({ grouped_by: args.group_by, groups }, null, 2) };
      }

      const above = filtered.filter((vp) => vp.pricing.currentPosition === 'above_market').length;
      const below = filtered.filter((vp) => vp.pricing.currentPosition === 'below_market').length;
      const inMarket = filtered.filter((vp) => vp.pricing.currentPosition === 'in_market').length;
      const noData = filtered.filter((vp) => vp.pricing.currentPosition === null).length;
      const prices = filtered.map((vp) => vp.vehicle.price);
      const targets = filtered
        .filter((vp) => vp.pricing.suggestedTarget !== null)
        .map((vp) => vp.pricing.suggestedTarget!);
      const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      const avgTarget = targets.length ? Math.round(targets.reduce((a, b) => a + b, 0) / targets.length) : 0;

      return {
        content: JSON.stringify(
          {
            total: filtered.length,
            price_position: { above_market: above, in_market: inMarket, below_market: below, no_data: noData },
            avg_current_price_eur: avgPrice,
            avg_target_price_eur: avgTarget,
            price_range_eur: { min: Math.min(...prices), max: Math.max(...prices) },
          },
          null,
          2,
        ),
      };
    }

    case 'generate_chart': {
      const chart: ChartConfig = {
        type: toolArgs.type as ChartConfig['type'],
        title: toolArgs.title as string,
        data: toolArgs.data as ChartConfig['data'],
        xLabel: toolArgs.x_label as string | undefined,
        yLabel: toolArgs.y_label as string | undefined,
      };
      return {
        content: `Chart "${chart.title}" generated successfully.`,
        chart,
      };
    }

    default:
      return { content: `Unknown tool: ${toolName}` };
  }
}
