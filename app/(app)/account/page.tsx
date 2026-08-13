import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { DeleteAccountForm } from "@/components/app/DeleteAccountForm";
import { GenerationDefaultsForm } from "@/components/app/GenerationDefaultsForm";
import { Container } from "@/components/ui/Container";
import { requireUserId } from "@/lib/auth";
import { PROVIDER_UNITS_PER_NEURON } from "@/lib/ai/catalog";
import { getPreferencesForOwner } from "@/lib/db/account";
import { readOwnerUsageSummary } from "@/lib/db/quotas";
import { countGenerationsForUser } from "@/lib/db/queries";
import { resolveGenerationChoice } from "@/lib/generations/choice";

function formatResetTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function formatProviderUnits(units: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    units / PROVIDER_UNITS_PER_NEURON,
  );
}

function formatImageCount(count: number) {
  return `${count} ${count === 1 ? "image" : "images"}`;
}

export default async function AccountPage() {
  const userId = await requireUserId();
  const [user, generationCount, usage, preferences] = await Promise.all([
    currentUser(),
    countGenerationsForUser(userId),
    readOwnerUsageSummary(userId),
    getPreferencesForOwner(userId),
  ]);

  const initialChoice = resolveGenerationChoice(
    preferences
      ? {
          model: preferences.defaultModel,
          size: preferences.defaultSize,
          count: preferences.defaultCount,
        }
      : null,
  );

  const email =
    user?.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    )?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

  return (
    <Container className="py-16 md:py-24">
      <section aria-labelledby="account-title" className="max-w-[760px]">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1
              id="account-title"
              className="text-text text-[clamp(36px,7vw,64px)] leading-[1.2] font-normal tracking-[-0.01em]"
            >
              Account
            </h1>
            <p className="text-text-2 mt-4 text-[15px] leading-[26px]">
              Your identity and generation usage.
            </p>
          </div>
          <UserButton />
        </div>

        <dl className="border-line mt-12 grid gap-8 border-t pt-8 sm:grid-cols-3">
          <div>
            <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
              Email
            </dt>
            <dd className="text-text mt-3 break-words text-[15px]">
              {email ?? "No email available"}
            </dd>
          </div>
          <div>
            <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
              Joined
            </dt>
            <dd className="text-text mt-3 text-[15px]">
              {user
                ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                    new Date(user.createdAt),
                  )
                : "Not available"}
            </dd>
          </div>
          <div>
            <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
              Images
            </dt>
            <dd className="text-grad-stat mt-3 text-[40px] leading-none">
              {generationCount}
            </dd>
          </div>
        </dl>

        <section
          aria-labelledby="usage-title"
          className="border-line mt-12 border-t pt-8"
        >
          <h2 id="usage-title" className="text-text text-[22px] leading-[30px]">
            Generation usage
          </h2>

          {usage.available ? (
            <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
                  Used this hour
                </dt>
                <dd className="text-grad-stat mt-3 text-[40px] leading-none">
                  {usage.rollingUsed}
                </dd>
              </div>
              <div>
                <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
                  Remaining this hour
                </dt>
                <dd className="text-grad-stat mt-3 text-[40px] leading-none">
                  {usage.rollingRemaining}
                </dd>
              </div>
              <div>
                <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
                  Window reset
                </dt>
                <dd className="text-text mt-3 text-[15px] leading-[26px]">
                  {usage.rollingResetAt
                    ? formatResetTime(usage.rollingResetAt)
                    : "No active window"}
                </dd>
              </div>
              <div>
                <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
                  Accepted today
                </dt>
                <dd className="text-text mt-3 text-[15px] leading-[26px]">
                  {formatImageCount(usage.dailyAcceptedImages)}
                </dd>
              </div>
              <div>
                <dt className="text-text-3 text-[12px] font-medium tracking-[0.12em] uppercase">
                  Compute used today
                </dt>
                <dd className="text-text mt-3 text-[15px] leading-[26px]">
                  {formatProviderUnits(usage.dailyProviderUnits)} units
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-text-2 mt-6 text-[15px] leading-[26px]">
              Usage unavailable
            </p>
          )}
        </section>

        <section
          aria-labelledby="defaults-title"
          className="border-line mt-12 border-t pt-8"
        >
          <h2
            id="defaults-title"
            className="text-text text-[22px] leading-[30px]"
          >
            Generation defaults
          </h2>
          <p className="text-text-2 mt-3 max-w-[62ch] text-[15px] leading-[26px]">
            What the generator starts from. You can change any of it on every
            generation, and publishing is always confirmed there.
          </p>
          <GenerationDefaultsForm
            initialChoice={initialChoice}
            initialPublish={preferences?.defaultVisibility === "public"}
          />
        </section>

        <section
          aria-labelledby="data-title"
          className="border-line mt-12 border-t pt-8"
        >
          <h2 id="data-title" className="text-text text-[22px] leading-[30px]">
            Your data
          </h2>
          <p className="text-text-2 mt-3 max-w-[62ch] text-[15px] leading-[26px]">
            Export gives you a JSON file with your prompts, image links, usage
            records and defaults. Deleting removes all of it, along with the
            images themselves.
          </p>

          <p className="mt-6">
            <a
              href="/account/export"
              className="border-line text-text hover:border-text-3 rounded-pill inline-flex items-center justify-center border px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]"
            >
              Export my data
            </a>
          </p>

          <DeleteAccountForm />
        </section>
      </section>
    </Container>
  );
}
