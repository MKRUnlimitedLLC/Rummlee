/** Company-level costs. Not customer fees, not referral pay, not a tax return. */

export const DE_MINIMIS_CENTS = 250_000;
export const NEC_REPORT_CENTS = 200_000;

export const EXPENSE_CATEGORIES = [
  "hosting",
  "domestic_development",
  "foreign_development",
  "contract_labor",
  "professional",
  "formation",
  "pre_opening",
  "meals",
  "travel",
  "equipment",
  "insurance",
  "charitable_cash",
  "entertainment",
  "personal",
  "political",
  "fine",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const LABELS: Record<ExpenseCategory, string> = {
  hosting: "Hosting, domain, and off-the-shelf software",
  domestic_development: "Domestic product development",
  foreign_development: "Foreign development",
  contract_labor: "Contract labor, not research",
  professional: "Legal and accounting after opening",
  formation: "Forming the corporation",
  pre_opening: "Costs before the business opened",
  meals: "Business meal",
  travel: "Business travel, not a meal",
  equipment: "Equipment",
  insurance: "Business insurance",
  charitable_cash: "Cash paid to a qualified charity",
  entertainment: "Entertainment",
  personal: "Personal",
  political: "Political or lobbying",
  fine: "Fine or penalty",
};

export function expenseLabel(category: ExpenseCategory) {
  return LABELS[category];
}

export type ExpenseClass = {
  category: ExpenseCategory;
  treatment: string;
  deductibleCents: number;
  parkedCents: number;
  blockedCents: number;
  needs1099: boolean;
  qre: boolean;
  note: string;
};

const BLOCKED = new Set<ExpenseCategory>(["entertainment", "personal", "political", "fine"]);
const NEC = new Set<ExpenseCategory>([
  "domestic_development",
  "foreign_development",
  "contract_labor",
  "professional",
  "formation",
  "pre_opening",
]);

export function classifyExpense(input: {
  category: ExpenseCategory;
  amountCents: number;
  hasReceipt: boolean;
  businessPurpose: string;
  paidBy: "company" | "founder";
}): { ok: true; row: ExpenseClass } | { ok: false; error: string } {
  const purpose = input.businessPurpose.trim();
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "Enter the amount in cents, greater than zero." };
  }
  if (purpose.length < 15) {
    return { ok: false, error: "Write what the cost was for. A payee name is not a business purpose." };
  }
  if (!input.hasReceipt && !BLOCKED.has(input.category)) {
    return { ok: false, error: "No receipt, no deduction. Park a personal cost only if you mark it personal." };
  }
  if (input.paidBy === "founder" && !input.hasReceipt) {
    return { ok: false, error: "A founder reimbursement needs a receipt. Without one it is not a company expense." };
  }

  const amount = input.amountCents;
  const needs1099 = NEC.has(input.category);
  const base = {
    category: input.category,
    needs1099,
    qre: input.category === "domestic_development",
    parkedCents: 0,
    blockedCents: 0,
    deductibleCents: 0,
  };

  if (BLOCKED.has(input.category)) {
    const why =
      input.category === "entertainment"
        ? "Entertainment is not deductible."
        : input.category === "fine"
          ? "A fine or penalty is not deductible."
          : input.category === "political"
            ? "Political and lobbying costs are not deductible."
            : "A personal cost is not a company deduction.";
    return {
      ok: true,
      row: { ...base, treatment: "nondeductible", blockedCents: amount, note: why },
    };
  }

  if (input.category === "meals") {
    const deductibleCents = Math.round(amount / 2);
    return {
      ok: true,
      row: {
        ...base,
        treatment: "meals_50",
        deductibleCents,
        blockedCents: amount - deductibleCents,
        note: "Half of a business meal. The rest is not deductible. Entertainment is never a meal.",
      },
    };
  }

  if (input.category === "foreign_development") {
    return {
      ok: true,
      row: {
        ...base,
        treatment: "rd_foreign_15yr",
        parkedCents: amount,
        qre: false,
        note: "Foreign research is amortized over 15 years. It is not a current deduction and not a U.S. research credit.",
      },
    };
  }

  if (input.category === "equipment") {
    const small = amount <= DE_MINIMIS_CENTS;
    return {
      ok: true,
      row: {
        ...base,
        treatment: small ? "de_minimis_candidate" : "capitalize",
        parkedCents: amount,
        note: small
          ? "At or under $2,500. Deduct it only if the de minimis policy is already in the minute book. This row does not take the election."
          : "Over $2,500. Capitalize. Section 179 or bonus depreciation is an election on the return, not an automatic write-off.",
      },
    };
  }

  if (input.category === "formation" || input.category === "pre_opening") {
    const startup = input.category === "pre_opening";
    return {
      ok: true,
      row: {
        ...base,
        treatment: startup ? "startup_195" : "org_248",
        parkedCents: amount,
        note: startup
          ? "A cost before the business opened. Up to $5,000 can be deducted in the year business begins, less the amount these costs exceed $50,000. The rest is 180 months. Do not put hosting from after launch in this bucket."
          : "Forming the corporation. Same $5,000 / 180-month pattern as startup costs, and a separate bucket. Ongoing legal advice is professional, not formation.",
      },
    };
  }

  if (input.category === "charitable_cash") {
    return {
      ok: true,
      row: {
        ...base,
        treatment: "charity_170",
        parkedCents: amount,
        needs1099: false,
        note: "Deductible only if paid to a qualified charity, and only up to 10% of the corporation’s taxable income. Accruing the pledge is not the deduction.",
      },
    };
  }

  return {
    ok: true,
    row: {
      ...base,
      treatment: input.category === "domestic_development" ? "rd_174a" : "ordinary",
      deductibleCents: amount,
      note:
        input.category === "domestic_development"
          ? "Domestic research is deductible in the year paid for tax years beginning after 2024. Keep what uncertainty the work solved. The research credit is a separate computation and can require an addback."
          : input.paidBy === "founder"
            ? "Deductible to the company only as an accountable-plan reimbursement: receipt, purpose, and repayment of the founder. It is not wages."
            : "Ordinary and necessary. Deduct in the year paid, unless the invoice covers a later year.",
    },
  };
}
