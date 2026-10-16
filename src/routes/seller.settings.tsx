import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  getIdentity,
  getOrganizationProfile,
  getOrganizations,
  getTeamMembers,
  getVerificationDetails,
  updateSellerBusinessProfile,
  type BusinessAddress,
  type Organization,
  type OrganizationProfile,
  type TeamRole,
  type VerificationDetails,
} from "@/lib/marketplace";

export const Route = createFileRoute("/seller/settings")({
  head: () => ({
    meta: [
      { title: "Organization settings | FEA Bulk" },
      { name: "description", content: "Manage your FEA Bulk seller business profile." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { organization?: string } =>
    typeof search["organization"] === "string" ? { organization: search["organization"] } : {},
  component: SellerSettings,
});

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const PAN_LAST4_PATTERN = /^[A-Z0-9]{4}$/;
const CIN_PATTERN = /^[A-Z0-9-]{4,21}$/;
const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
const PIN_PATTERN = /^[0-9]{6}$/;
const BUSINESS_TYPES = ["Proprietorship", "Partnership", "Private limited company", "LLP", "Other"];
const EDITABLE_VERIFICATION_STATUSES = ["draft", "rejected", "resubmission_required", "expired"];
const input = "w-full border bg-white px-3 py-2 text-[#17233A]";

type AddressForm = { addressLine: string; city: string; state: string; pinCode: string };
type FieldName =
  | "legalName"
  | "displayName"
  | "gstin"
  | "businessType"
  | "panLast4"
  | "cinOrLlpin"
  | "udyamRegistration"
  | "registeredAddressLine"
  | "registeredCity"
  | "registeredState"
  | "registeredPinCode"
  | "operatingAddressLine"
  | "operatingCity"
  | "operatingState"
  | "operatingPinCode";
type FieldErrors = Partial<Record<FieldName, string>>;
type Settings = {
  sellers: Organization[];
  profile: OrganizationProfile;
  verification: VerificationDetails | null;
  role: TeamRole | null;
};

const VERIFICATION_LABELS: Record<string, string> = {
  draft: "Not submitted",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Verified",
  rejected: "Rejected",
  resubmission_required: "Resubmission required",
  expired: "Expired",
};

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (/organizations_gstin_key|duplicate key/i.test(message)) {
    return "This GSTIN is already registered to another business.";
  }
  if (/registration details are locked/i.test(message)) {
    return "Registration details cannot be changed while verification is submitted, under review or approved.";
  }
  if (/invalid|address is required/i.test(message)) {
    return "Some details were rejected. Check the fields and try again.";
  }
  if (/server returned no data|permission denied|row-level security|access denied/i.test(message)) {
    return "Only an owner or administrator can change organization settings.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "We could not reach FEA Bulk. Check your connection and try again.";
  }
  return message;
}

function formatAddress(address: Record<string, string> | null) {
  if (!address) return "Not provided";
  const line = [
    address["address_line"] ?? address["line1"] ?? address["address"],
    address["city"],
    address["state"],
    address["pin_code"] ?? address["pin"] ?? address["postal_code"],
  ]
    .filter((part) => part && part.trim())
    .join(", ");
  return line || "Not provided";
}

function toAddressForm(address: Record<string, string> | null): AddressForm {
  return {
    addressLine: address?.["address_line"] ?? address?.["line1"] ?? address?.["address"] ?? "",
    city: address?.["city"] ?? "",
    state: address?.["state"] ?? "",
    pinCode: address?.["pin_code"] ?? address?.["pin"] ?? address?.["postal_code"] ?? "",
  };
}

function toBusinessAddress(address: AddressForm): BusinessAddress {
  return {
    address_line: address.addressLine.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    pin_code: address.pinCode.trim(),
    country: "India",
  };
}

function sameAddress(a: AddressForm, b: AddressForm) {
  return (
    a.addressLine.trim() === b.addressLine.trim() &&
    a.city.trim() === b.city.trim() &&
    a.state.trim() === b.state.trim() &&
    a.pinCode.trim() === b.pinCode.trim()
  );
}

function SellerSettings() {
  const router = useRouter();
  const { organization: requestedId } = Route.useSearch();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const user = await getIdentity();
      if (!user) {
        setSignedOut(true);
        setSettings(null);
        return;
      }
      setSignedOut(false);
      const sellers = (await getOrganizations()).filter(
        (item) => item.kind === "seller" || item.kind === "both",
      );
      const selected = sellers.find((item) => item.id === requestedId) ?? sellers[0];
      if (!selected) {
        setSettings(null);
        return;
      }
      const [profile, verification, team] = await Promise.all([
        getOrganizationProfile(selected.id),
        getVerificationDetails(selected.id),
        getTeamMembers(selected.id),
      ]);
      const role = team.find((member) => member.user_id === user.id)?.role ?? null;
      setSettings({ sellers, profile, verification, role });
    } catch (error) {
      setLoadError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [requestedId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#17233A]">
      <header className="border-b border-[#DDE5EE] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="/" className="text-xl font-black text-[#102B52]">
            FEA<span className="text-[#F87908]">Bulk</span>
          </a>
          <Link to="/app" className="text-sm font-bold text-[#102B52]">
            Back to workspace
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <nav aria-label="Breadcrumb" className="text-xs font-bold text-[#8A95A8]">
          <Link to="/app" className="hover:text-[#102B52]">
            Seller workspace
          </Link>
          <span className="px-2">/</span>
          <span className="text-[#526178]">Organization settings</span>
        </nav>
        <p className="mt-5 text-xs font-black uppercase tracking-wider text-[#F87908]">
          Organization settings
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#102B52]">Seller business profile</h1>
        {loading ? (
          <p className="mt-8 text-sm font-semibold text-[#526178]" role="status">
            Loading organization settings…
          </p>
        ) : loadError ? (
          <section className="mt-8 border border-red-300 bg-red-50 p-6" role="alert">
            <h2 className="text-lg font-black text-red-800">
              We could not load your organization settings.
            </h2>
            <p className="mt-2 text-sm text-red-800">{loadError}</p>
            <button className="button mt-4" onClick={() => void load()}>
              Try again
            </button>
          </section>
        ) : signedOut ? (
          <section className="mt-8 border bg-white p-6">
            <h2 className="text-xl font-black">Sign in to continue</h2>
            <a className="button mt-4 inline-block" href="/auth">
              Sign in
            </a>
          </section>
        ) : !settings ? (
          <section className="mt-8 border bg-white p-6">
            <h2 className="text-xl font-black text-[#102B52]">No seller organization</h2>
            <p className="mt-2 text-sm text-[#526178]">
              Organization settings are available to members of a seller business.
            </p>
            <Link to="/app" className="button-secondary mt-4 inline-block">
              Back to workspace
            </Link>
          </section>
        ) : (
          <SettingsContent
            key={settings.profile.id}
            settings={settings}
            onSaved={(profile, verification) =>
              setSettings({
                ...settings,
                profile,
                verification,
                sellers: settings.sellers.map((item) =>
                  item.id === profile.id ? { ...item, display_name: profile.display_name } : item,
                ),
              })
            }
            onSelect={(organization) =>
              void router.navigate({ to: "/seller/settings", search: { organization } })
            }
          />
        )}
      </div>
    </main>
  );
}

function SettingsContent({
  settings,
  onSaved,
  onSelect,
}: {
  settings: Settings;
  onSaved: (profile: OrganizationProfile, verification: VerificationDetails | null) => void;
  onSelect: (organizationId: string) => void;
}) {
  const { sellers, profile, verification, role } = settings;
  const canEdit = role === "owner" || role === "administrator";
  const registrationEditable =
    !verification || EDITABLE_VERIFICATION_STATUSES.includes(verification.status);
  const initialRegistered = toAddressForm(verification?.registered_address ?? null);
  const initialOperating = toAddressForm(verification?.operating_address ?? null);
  const [editing, setEditing] = useState(false);
  const [legalName, setLegalName] = useState(profile.legal_name);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [gstin, setGstin] = useState(profile.gstin ?? "");
  const [businessType, setBusinessType] = useState(verification?.business_type ?? "");
  const [panLast4, setPanLast4] = useState(verification?.pan_last4 ?? "");
  const [cinOrLlpin, setCinOrLlpin] = useState(verification?.cin_or_llpin ?? "");
  const [udyamRegistration, setUdyamRegistration] = useState(
    verification?.udyam_registration ?? "",
  );
  const [registered, setRegistered] = useState(initialRegistered);
  const [operating, setOperating] = useState(initialOperating);
  const [operatingSame, setOperatingSame] = useState(
    sameAddress(initialRegistered, initialOperating),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function resetForm() {
    const nextRegistered = toAddressForm(verification?.registered_address ?? null);
    const nextOperating = toAddressForm(verification?.operating_address ?? null);
    setErrors({});
    setLegalName(profile.legal_name);
    setDisplayName(profile.display_name);
    setGstin(profile.gstin ?? "");
    setBusinessType(verification?.business_type ?? "");
    setPanLast4(verification?.pan_last4 ?? "");
    setCinOrLlpin(verification?.cin_or_llpin ?? "");
    setUdyamRegistration(verification?.udyam_registration ?? "");
    setRegistered(nextRegistered);
    setOperating(nextOperating);
    setOperatingSame(sameAddress(nextRegistered, nextOperating));
  }

  function validateAddress(
    address: AddressForm,
    prefix: "registered" | "operating",
    next: FieldErrors,
  ) {
    if (address.addressLine.trim().length < 5) {
      next[`${prefix}AddressLine`] = "Enter the street address (at least 5 characters).";
    }
    if (address.city.trim().length < 2) next[`${prefix}City`] = "Enter the city.";
    if (address.state.trim().length < 2) next[`${prefix}State`] = "Enter the state.";
    if (!PIN_PATTERN.test(address.pinCode.trim())) {
      next[`${prefix}PinCode`] = "Enter a 6-digit PIN code.";
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const legal = legalName.trim();
    const display = displayName.trim();
    const tax = gstin.trim().toUpperCase();
    if (legal.length < 2 || legal.length > 200) {
      next.legalName = "Enter the legal business name (2–200 characters).";
    }
    if (display.length < 2 || display.length > 120) {
      next.displayName = "Enter a trading name (2–120 characters).";
    }
    if (tax && !GSTIN_PATTERN.test(tax)) {
      next.gstin = "Enter a valid 15-character GSTIN, for example 27AAAAA0000A1Z5.";
    }
    if (registrationEditable) {
      if (!BUSINESS_TYPES.includes(businessType)) next.businessType = "Select a business type.";
      const pan = panLast4.trim().toUpperCase();
      if (pan && !PAN_LAST4_PATTERN.test(pan)) {
        next.panLast4 = "Enter exactly the last 4 characters of the PAN.";
      }
      const cin = cinOrLlpin.trim().toUpperCase();
      if (cin && !CIN_PATTERN.test(cin)) {
        next.cinOrLlpin = "Enter a valid CIN or LLPIN (4–21 letters, numbers or hyphens).";
      }
      const udyam = udyamRegistration.trim().toUpperCase();
      if (udyam && !UDYAM_PATTERN.test(udyam)) {
        next.udyamRegistration = "Use the format UDYAM-KA-00-1234567.";
      }
      validateAddress(registered, "registered", next);
      if (!operatingSame) validateAddress(operating, "operating", next);
    }
    return next;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setNotice({ tone: "error", text: "Please correct the highlighted fields." });
      return;
    }
    setBusy(true);
    try {
      const registeredAddress = toBusinessAddress(registered);
      const updated = await updateSellerBusinessProfile(profile.id, {
        legalName: legalName.trim(),
        displayName: displayName.trim(),
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        registration: registrationEditable
          ? {
              businessType,
              panLast4: panLast4.trim() ? panLast4.trim().toUpperCase() : null,
              cinOrLlpin: cinOrLlpin.trim() ? cinOrLlpin.trim().toUpperCase() : null,
              udyamRegistration: udyamRegistration.trim()
                ? udyamRegistration.trim().toUpperCase()
                : null,
              registeredAddress,
              operatingAddress: operatingSame ? registeredAddress : toBusinessAddress(operating),
            }
          : null,
      });
      const refreshed = await getVerificationDetails(profile.id);
      setEditing(false);
      setNotice({ tone: "success", text: "Organization settings were updated." });
      onSaved(updated, refreshed);
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  const verificationLabel = verification
    ? (VERIFICATION_LABELS[verification.status] ?? verification.status.replaceAll("_", " "))
    : "Not started";

  function textField(
    name: FieldName,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: {
      maxLength?: number;
      placeholder?: string;
      upper?: boolean;
      inputMode?: "numeric";
    } = {},
  ) {
    return (
      <Field label={label} error={errors[name]}>
        <input
          className={`${input} ${errors[name] ? "border-red-600" : "border-[#C9D3DF]"}`}
          value={value}
          maxLength={options.maxLength}
          placeholder={options.placeholder}
          inputMode={options.inputMode}
          aria-invalid={Boolean(errors[name])}
          onChange={(event) =>
            onChange(options.upper ? event.target.value.toUpperCase() : event.target.value)
          }
        />
      </Field>
    );
  }

  function addressFields(
    prefix: "registered" | "operating",
    address: AddressForm,
    setAddress: (address: AddressForm) => void,
  ) {
    return (
      <>
        <div className="sm:col-span-2">
          {textField(
            `${prefix}AddressLine`,
            "Street address",
            address.addressLine,
            (value) => setAddress({ ...address, addressLine: value }),
            { maxLength: 300 },
          )}
        </div>
        {textField(`${prefix}City`, "City", address.city, (value) =>
          setAddress({ ...address, city: value }),
        )}
        {textField(`${prefix}State`, "State", address.state, (value) =>
          setAddress({ ...address, state: value }),
        )}
        {textField(
          `${prefix}PinCode`,
          "PIN code",
          address.pinCode,
          (value) => setAddress({ ...address, pinCode: value.replace(/\D/g, "") }),
          { maxLength: 6, inputMode: "numeric" },
        )}
      </>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      {sellers.length > 1 && (
        <label className="grid max-w-sm gap-1 text-sm font-semibold text-[#405069]">
          Seller business
          <select
            className={`${input} border-[#C9D3DF]`}
            value={profile.id}
            onChange={(event) => onSelect(event.target.value)}
          >
            {sellers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.display_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`border p-3 text-sm ${notice.tone === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-green-300 bg-green-50 text-green-800"}`}
        >
          {notice.text}
        </p>
      )}
      <section className="border border-[#DDE5EE] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#102B52]">{profile.display_name}</h2>
            <p className="mt-1 text-sm capitalize text-[#526178]">
              {profile.kind} organization · your role: {role ? role.replaceAll("_", " ") : "member"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-[#DDE5EE] bg-[#F7F8FA] px-3 py-2 text-xs font-black uppercase tracking-wider text-[#526178]">
              Verification: {verificationLabel}
            </span>
            {canEdit && !editing && (
              <button
                className="button-secondary"
                onClick={() => {
                  setNotice(null);
                  resetForm();
                  setEditing(true);
                }}
              >
                Edit business profile
              </button>
            )}
          </div>
        </div>
        {!canEdit && (
          <p className="mt-4 border border-[#DDE5EE] bg-[#F7F8FA] p-3 text-sm text-[#526178]">
            Only an owner or administrator can change these details.
          </p>
        )}
        {verification?.reviewer_notes && (
          <p className="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm">
            Reviewer notes: {verification.reviewer_notes}
          </p>
        )}
        {editing ? (
          <form onSubmit={save} noValidate className="mt-6 grid gap-6 sm:max-w-3xl">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-black uppercase tracking-wider text-[#102B52]">
                Business identity
              </legend>
              {textField("legalName", "Legal business name", legalName, setLegalName, {
                maxLength: 200,
              })}
              {textField("displayName", "Trading name", displayName, setDisplayName, {
                maxLength: 120,
              })}
              {textField("gstin", "GSTIN (optional)", gstin, setGstin, {
                maxLength: 15,
                placeholder: "27AAAAA0000A1Z5",
                upper: true,
              })}
            </fieldset>
            {registrationEditable ? (
              <>
                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="mb-3 text-sm font-black uppercase tracking-wider text-[#102B52]">
                    Registration details
                  </legend>
                  <Field label="Business type" error={errors.businessType}>
                    <select
                      className={`${input} ${errors.businessType ? "border-red-600" : "border-[#C9D3DF]"}`}
                      value={businessType}
                      aria-invalid={Boolean(errors.businessType)}
                      onChange={(event) => setBusinessType(event.target.value)}
                    >
                      <option value="">Select type</option>
                      {BUSINESS_TYPES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </Field>
                  {textField("panLast4", "PAN last 4 (optional)", panLast4, setPanLast4, {
                    maxLength: 4,
                    upper: true,
                  })}
                  {textField("cinOrLlpin", "CIN or LLPIN (optional)", cinOrLlpin, setCinOrLlpin, {
                    maxLength: 21,
                    upper: true,
                  })}
                  {textField(
                    "udyamRegistration",
                    "Udyam registration (optional)",
                    udyamRegistration,
                    setUdyamRegistration,
                    { maxLength: 19, placeholder: "UDYAM-KA-00-1234567", upper: true },
                  )}
                </fieldset>
                <fieldset className="grid gap-4 sm:grid-cols-3">
                  <legend className="mb-3 text-sm font-black uppercase tracking-wider text-[#102B52]">
                    Registered address
                  </legend>
                  {addressFields("registered", registered, setRegistered)}
                </fieldset>
                <fieldset className="grid gap-4 sm:grid-cols-3">
                  <legend className="mb-3 text-sm font-black uppercase tracking-wider text-[#102B52]">
                    Operating address
                  </legend>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#405069] sm:col-span-3">
                    <input
                      type="checkbox"
                      checked={operatingSame}
                      onChange={(event) => setOperatingSame(event.target.checked)}
                    />
                    Same as registered address
                  </label>
                  {!operatingSame && addressFields("operating", operating, setOperating)}
                </fieldset>
              </>
            ) : (
              <p className="border border-[#DDE5EE] bg-[#F7F8FA] p-3 text-sm text-[#526178]">
                Registration details are locked while verification is{" "}
                {verificationLabel.toLowerCase()}.
              </p>
            )}
            <div className="flex gap-2">
              <button disabled={busy} className="button">
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Legal business name" value={profile.legal_name} />
            <Detail label="Trading name" value={profile.display_name} />
            <Detail label="GSTIN" value={profile.gstin ?? "Not provided"} />
            <Detail label="Account status" value={profile.status.replaceAll("_", " ")} />
            <Detail label="Business type" value={verification?.business_type ?? "Not provided"} />
            <Detail
              label="PAN (last 4)"
              value={verification?.pan_last4 ? `••••••${verification.pan_last4}` : "Not provided"}
            />
            <Detail label="CIN / LLPIN" value={verification?.cin_or_llpin ?? "Not provided"} />
            <Detail
              label="Udyam registration"
              value={verification?.udyam_registration ?? "Not provided"}
            />
            <Detail
              label="Submitted for verification"
              value={
                verification?.submitted_at
                  ? new Date(verification.submitted_at).toLocaleDateString()
                  : "Not yet"
              }
            />
            <Detail
              label="Registered address"
              value={formatAddress(verification?.registered_address ?? null)}
            />
            <Detail
              label="Operating address"
              value={formatAddress(verification?.operating_address ?? null)}
            />
          </dl>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wider text-[#8A95A8]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#17233A]">{value}</dd>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-[#405069]">
      {label}
      {children}
      {error && (
        <span className="text-xs font-semibold text-red-700" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
