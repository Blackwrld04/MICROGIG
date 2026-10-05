"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { GIG_MAX_PRICE_CENTS, GIG_MIN_PRICE_CENTS, PLATFORM_FEE_BPS, formatCents, platformFeeCents, sellerNetCents } from "@/lib/money";

/** Live "you earn" calculator using the real §11.5 fee maths. */
export function EarningsCalculator() {
  const [price, setPrice] = useState(3500);
  const [perWeek, setPerWeek] = useState(10);
  const net = sellerNetCents(price, PLATFORM_FEE_BPS);

  return (
    <div className="space-y-6 rounded-2xl bg-white/5 p-6 ring-1 ring-white/15">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="calc-price" className="text-sm font-semibold text-white">
            Gig price
          </label>
          <output htmlFor="calc-price" className="text-lg font-bold text-white">
            {formatCents(price)}
          </output>
        </div>
        <input
          id="calc-price"
          type="range"
          min={GIG_MIN_PRICE_CENTS}
          max={GIG_MAX_PRICE_CENTS}
          step={500}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="calc-orders" className="text-sm font-semibold text-white">
            Orders per week
          </label>
          <output htmlFor="calc-orders" className="text-lg font-bold text-white">
            {perWeek}
          </output>
        </div>
        <input
          id="calc-orders"
          type="range"
          min={1}
          max={40}
          value={perWeek}
          onChange={(e) => setPerWeek(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <dl className="grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
        <div>
          <dt className="text-xs text-white/80">You earn per order</dt>
          <dd className="text-2xl font-bold text-primary">
            <AnimatedNumber value={net} format={formatCents} durationMs={300} />
          </dd>
          <dd className="text-xs text-white/80">after the {formatCents(platformFeeCents(price, PLATFORM_FEE_BPS))} fee</dd>
        </div>
        <div>
          <dt className="text-xs text-white/80">Per month (4 weeks)</dt>
          <dd className="text-2xl font-bold text-primary" aria-live="polite">
            <AnimatedNumber value={net * perWeek * 4} format={formatCents} durationMs={300} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
