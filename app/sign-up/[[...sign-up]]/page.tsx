import { PageAtmosphere } from "@/components/motion/PageAtmosphere";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    /* `bg-ink` is dropped: the body already carries it, and an opaque main
       would paint over the wash behind it. */
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-16">
      <PageAtmosphere variant="quiet" />
      <div className="relative">
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
