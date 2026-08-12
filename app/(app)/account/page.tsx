import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Container } from "@/components/ui/Container";
import { requireUserId } from "@/lib/auth";
import { countGenerationsForUser } from "@/lib/db/queries";

export default async function AccountPage() {
  const userId = await requireUserId();
  const [user, generationCount] = await Promise.all([
    currentUser(),
    countGenerationsForUser(userId),
  ]);

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
      </section>
    </Container>
  );
}
