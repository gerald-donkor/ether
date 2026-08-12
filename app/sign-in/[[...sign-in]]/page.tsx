import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="bg-ink flex min-h-[100dvh] items-center justify-center px-5 py-16">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </main>
  );
}
