import { GeneratorWorkspace } from "@/components/app/GeneratorWorkspace";
import { Container } from "@/components/ui/Container";
import { requireUserId } from "@/lib/auth";
import { listGenerationsForUser } from "@/lib/db/queries";

export default async function GeneratePage() {
  const userId = await requireUserId();
  // Six, not the whole history: two rows of three at the existing grid, so the
  // section keeps its shape while /library takes over its role as the record.
  const generations = await listGenerationsForUser(userId, 6);

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
