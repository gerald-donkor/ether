import { GeneratorWorkspace } from "@/components/app/GeneratorWorkspace";
import { Container } from "@/components/ui/Container";
import { requireUserId } from "@/lib/auth";
import { listGenerationsForUser } from "@/lib/db/queries";

export default async function GeneratePage() {
  const userId = await requireUserId();
  const generations = await listGenerationsForUser(userId, 24);

  return (
    <Container className="py-16 md:py-24">
      <GeneratorWorkspace
        initialGenerations={generations.map((generation) => ({
          id: generation.id,
          prompt: generation.prompt,
          imageUrl: generation.imageUrl,
          width: generation.width,
          height: generation.height,
          isPublic: generation.isPublic,
          createdAt: generation.createdAt.toISOString(),
        }))}
      />
    </Container>
  );
}
