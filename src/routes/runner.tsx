import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuthGate, GuestGate } from "@/components/guest-gate";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CHECKR_ENABLED, RUNNERS_ENABLED, TEST_MODE } from "@/lib/rummlee/constants";
import { errMessage } from "@/lib/rummlee/errors";
import { money } from "@/lib/rummlee/format";
import { getRunnerDesk, saveRunnerDraft } from "@/lib/rummlee/runner";
import {
  RUNNER_CITIES,
  RUNNER_REPAY_CENTS,
  RUNNER_STANDARD,
  RUNNERS_OFF,
  runnerRepayCents,
  type RunnerVehicle,
} from "@/lib/rummlee/runner-policy";

export const Route = createFileRoute("/runner")({
  component: RunnerPage,
});

function RunnerPage() {
  const { user, showGuest, showLoading } = useAuthGate();
  const qc = useQueryClient();
  const desk = useQuery({ queryKey: ["runner"], queryFn: () => getRunnerDesk(), enabled: Boolean(user) && RUNNERS_ENABLED });
  const [age, setAge] = useState("30");
  const [licenseYears, setLicenseYears] = useState("5");
  const [city, setCity] = useState<(typeof RUNNER_CITIES)[number]>("Fargo");
  const [licenseState, setLicenseState] = useState("ND");
  const [vehicle, setVehicle] = useState<RunnerVehicle>("car");
  const [rangeMiles, setRangeMiles] = useState("15");
  const [smallDollars, setSmallDollars] = useState("2");
  const [bigDollars, setBigDollars] = useState("5");
  const [insuranceShown, setInsuranceShown] = useState(false);
  const [payoutNoted, setPayoutNoted] = useState(false);
  const [attested, setAttested] = useState(false);
  const [consented, setConsented] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      saveRunnerDraft({
        data: {
          age: Number(age),
          licenseYears: Number(licenseYears),
          city,
          licenseState: licenseState.toUpperCase(),
          vehicle,
          rangeMiles: Number(rangeMiles),
          smallPerMileCents: Math.round(Number(smallDollars) * 100),
          bigPerMileCents: Math.round(Number(bigDollars) * 100),
          insuranceShown,
          payoutNoted,
          attested,
          consented,
        },
      }),
    onSuccess: (result) => {
      toast.success(result.reason);
      void qc.invalidateQueries({ queryKey: ["runner"] });
    },
    onError: (error) => toast.error(errMessage(error)),
  });

  if (!RUNNERS_ENABLED) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="font-display text-3xl">Be a runner</h1>
        <p className="mt-4 text-sm text-muted">{RUNNERS_OFF}</p>
      </div>
    );
  }

  if (showLoading) return null;
  if (showGuest) return <GuestGate title="Be a runner" body="Sign in to save a runner application. No check is ordered from this page." />;

  const repay = runnerRepayCents(city, licenseState);
  const miles = Number(rangeMiles) || 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link to="/you" className="text-sm font-medium text-primary-ink">
        You
      </Link>
      <h1 className="mt-3 font-display text-3xl">Be a runner</h1>
      {!RUNNERS_ENABLED ? (
        <p className="mt-4 text-sm text-muted">{RUNNERS_OFF}</p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <p className="text-sm text-muted">
            You use your own car or truck. You are not an employee. You are paid by the mile. One range covers a small
            item and a big item. A trip past that range is not your job.
            {TEST_MODE ? " Test mode. No bank is charged." : ""}
            {!CHECKR_ENABLED ? " Checkr is not connected, so saving this does not order a check." : ""}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="runner-age">Age</Label>
              <Input id="runner-age" inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="runner-years">Years licensed</Label>
              <Input id="runner-years" inputMode="numeric" value={licenseYears} onChange={(event) => setLicenseYears(event.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="runner-city">City</Label>
            <select id="runner-city" className="mt-1 w-full rounded-xl border bg-surface px-3 py-2" value={city} onChange={(event) => setCity(event.target.value as (typeof RUNNER_CITIES)[number])}>
              {RUNNER_CITIES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="runner-state">License state</Label>
              <Input id="runner-state" maxLength={2} value={licenseState} onChange={(event) => setLicenseState(event.target.value.toUpperCase())} />
            </div>
            <div>
              <Label htmlFor="runner-vehicle">Vehicle</Label>
              <select id="runner-vehicle" className="mt-1 w-full rounded-xl border bg-surface px-3 py-2" value={vehicle} onChange={(event) => setVehicle(event.target.value as RunnerVehicle)}>
                <option value="car">Car</option>
                <option value="truck">Truck</option>
                <option value="both">Car and truck</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="runner-range">Range, miles</Label>
            <Input id="runner-range" inputMode="numeric" value={rangeMiles} onChange={(event) => setRangeMiles(event.target.value)} />
            <p className="mt-1 text-sm text-muted">
              {miles > 0 ? `${miles} miles at your small rate is ${money(Math.round(Number(smallDollars) * 100) * miles)}.` : "Set a range."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="runner-small">Small item, $ / mile</Label>
              <Input id="runner-small" inputMode="decimal" value={smallDollars} onChange={(event) => setSmallDollars(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="runner-big">Big item, $ / mile</Label>
              <Input id="runner-big" inputMode="decimal" value={bigDollars} onChange={(event) => setBigDollars(event.target.value)} />
            </div>
          </div>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={insuranceShown} onChange={(event) => setInsuranceShown(event.target.checked)} />
            I can show an insurance card in my name. The photo is not stored while this is off.
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={payoutNoted} onChange={(event) => setPayoutNoted(event.target.checked)} />
            I will add a payout account before a check is ordered. No bank is charged now.
          </label>
          <p className="text-sm text-muted">{RUNNER_STANDARD}</p>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />
            I meet that standard. This form does not ask me to list convictions.
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
            I consent to a Checkr driving record first, and a criminal search only if that record is clear.
            {repay === 0
              ? " Minnesota pays the check. Mile pay is not reduced."
              : ` The first ${money(RUNNER_REPAY_CENTS)} of mile pay repays the check after a pass. A fail owes nothing.`}
          </label>
          <Button type="submit" disabled={save.isPending || !desk.data?.enabled}>
            {save.isPending ? "Saving…" : "Save application"}
          </Button>
          {desk.data?.application ? (
            <p className="text-sm text-muted">Saved as {desk.data.application.status}. Checkr has not been ordered.</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
