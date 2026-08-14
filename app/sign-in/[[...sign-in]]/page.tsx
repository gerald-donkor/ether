import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    /* `bg-ink` is dropped: the body already carries it, and an opaque main
       would paint over the wash behind it. */
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-16">
      <PageAtmosphere variant="quiet" />
      <div className="relative">
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
      </div>
    </main>
  );
}
