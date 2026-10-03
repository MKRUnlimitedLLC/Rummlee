import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { errMessage } from "@/lib/rummlee/errors";
import {
  INTENT_OPTIONS,
  OWNERSHIP_NOTE_MAX,
  STORE_TYPES,
  parseHandoff,
  parseOwnership,
  parseWaitlist,
} from "@/lib/rummlee/launch-capture";
import { joinLaunchList } from "@/lib/rummlee/launch-list";
import { track } from "@/lib/rummlee/measure-browser";
import { capturePageUtm, utmPayload } from "@/lib/rummlee/utm-session";

function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute h-0 w-0 opacity-0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function WaitlistForm({
  idPrefix,
  onSuccess,
}: {
  idPrefix: string;
  onSuccess: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [company, setCompany] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseWaitlist({ email, intent, city, zip });
    if (!parsed.ok && !company.trim()) {
      toast.error(parsed.error);
      return;
    }
    setPending(true);
    try {
      const result = await joinLaunchList({
        data: {
          path: "waitlist",
          email,
          intent,
          city,
          zip,
          company,
          ...utmPayload(capturePageUtm()),
        },
      });
      onSuccess(result.message);
      track("launch_signup");
    } catch (error) {
      toast.error(errMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="relative mt-5 space-y-3" onSubmit={submit}>
      <div>
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-fg">
          I’m interested as…
        </legend>
        <div className="space-y-2">
          {INTENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer gap-3 rounded-lg bg-bg px-3 py-2.5"
            >
              <input
                className="mt-1"
                type="radio"
                name={`${idPrefix}-intent`}
                value={option.value}
                checked={intent === option.value}
                onChange={() => setIntent(option.value)}
                required
              />
              <span>
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block text-sm text-muted">{option.label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            autoComplete="address-level2"
            placeholder="Fargo"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-zip`}>ZIP</Label>
          <Input
            id={`${idPrefix}-zip`}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="58102"
            maxLength={10}
            value={zip}
            onChange={(event) => setZip(event.target.value)}
          />
        </div>
      </div>
      <p className="text-sm text-muted">City or ZIP — at least one.</p>
      <Honeypot value={company} onChange={setCompany} />
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Notify me"}
      </Button>
    </form>
  );
}

export function HandoffForm({
  idPrefix,
  onSuccess,
}: {
  idPrefix: string;
  onSuccess: (message: string) => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [storeType, setStoreType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whyUs, setWhyUs] = useState("");
  const [hours, setHours] = useState("");
  const [parking, setParking] = useState("");
  const [company, setCompany] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseHandoff({
      businessName,
      contactName,
      city,
      zip,
      storeType,
      email,
      phone,
      whyUs,
      hours,
      parking,
    });
    if (!parsed.ok && !company.trim()) {
      toast.error(parsed.error);
      return;
    }
    setPending(true);
    try {
      const result = await joinLaunchList({
        data: {
          path: "handoff_location",
          businessName,
          contactName,
          city,
          zip,
          storeType,
          email,
          phone,
          whyUs,
          hours,
          parking,
          company,
          ...utmPayload(capturePageUtm()),
        },
      });
      onSuccess(result.message);
      track("handoff_apply");
    } catch (error) {
      toast.error(errMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="relative space-y-3" onSubmit={submit}>
      <div>
        <Label htmlFor={`${idPrefix}-business`}>Business name</Label>
        <Input
          id={`${idPrefix}-business`}
          autoComplete="organization"
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          required
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-contact`}>Contact name</Label>
        <Input
          id={`${idPrefix}-contact`}
          autoComplete="name"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            autoComplete="address-level2"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-zip`}>ZIP (optional)</Label>
          <Input
            id={`${idPrefix}-zip`}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            value={zip}
            onChange={(event) => setZip(event.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Store type</Label>
        <select
          id={`${idPrefix}-type`}
          className="h-11 w-full rounded-lg bg-surface px-3.5 text-[15px] text-fg shadow-[0_0_0_1px_rgba(28,25,21,0.1)] outline-none focus:shadow-[0_0_0_2px_var(--color-primary)]"
          value={storeType}
          onChange={(event) => setStoreType(event.target.value)}
          required
        >
          <option value="">Select</option>
          {STORE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </div>
      <p className="text-sm text-muted">Email or phone — at least one.</p>
      <div>
        <Label htmlFor={`${idPrefix}-why`}>
          Why you’d be a good handoff spot (optional)
        </Label>
        <Textarea
          id={`${idPrefix}-why`}
          value={whyUs}
          onChange={(event) => setWhyUs(event.target.value)}
          maxLength={500}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-hours`}>Hours (optional)</Label>
        <Input
          id={`${idPrefix}-hours`}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          maxLength={160}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-parking`}>Parking notes (optional)</Label>
        <Input
          id={`${idPrefix}-parking`}
          value={parking}
          onChange={(event) => setParking(event.target.value)}
          maxLength={160}
        />
      </div>
      <Honeypot value={company} onChange={setCompany} />
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </Button>
      <p className="text-sm text-muted">
        No card. Asking is free. This is not a promise of exclusivity, payment,
        or a go-live date.
      </p>
    </form>
  );
}

export function OwnershipForm({
  idPrefix,
  onSuccess,
}: {
  idPrefix: string;
  onSuccess: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [whyUs, setWhyUs] = useState("");
  const [company, setCompany] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseOwnership({ email, businessName, whyUs });
    if (!parsed.ok && !company.trim()) {
      toast.error(parsed.error);
      return;
    }
    setPending(true);
    try {
      const result = await joinLaunchList({
        data: {
          path: "ownership_interest",
          email,
          businessName,
          whyUs,
          company,
          ...utmPayload(capturePageUtm()),
        },
      });
      onSuccess(result.message);
      track("investor_signup");
    } catch (error) {
      toast.error(errMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="relative mt-4 space-y-3" onSubmit={submit}>
      <input type="hidden" name="path" value="ownership_interest" />
      <input type="hidden" name="source" value="site" />
      <div>
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-company`}>Company</Label>
        <Input
          id={`${idPrefix}-company`}
          autoComplete="organization"
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          maxLength={120}
          required
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-note`}>Brief note (optional)</Label>
        <Textarea
          id={`${idPrefix}-note`}
          value={whyUs}
          onChange={(event) => setWhyUs(event.target.value)}
          maxLength={OWNERSHIP_NOTE_MAX}
        />
      </div>
      <Honeypot value={company} onChange={setCompany} />
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </Button>
      <p className="text-sm text-muted">
        No card. No phone. This is not a store application, and it is not a
        promise of shares, an allocation, or a closing date.
      </p>
    </form>
  );
}
