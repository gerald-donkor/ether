import { GeneratorWorkspace } from "@/components/app/GeneratorWorkspace";
import { Container } from "@/components/ui/Container";
import { requireUserId } from "@/lib/auth";
import { getPreferencesForOwner } from "@/lib/db/account";
import { listGenerationsForUser } from "@/lib/db/queries";
import { resolveGenerationChoice } from "@/lib/generations/choice";

export default async function GeneratePage() {
  const userId = await requireUserId();
  // Six, not the whole history: two rows of three at the existing grid, so the
  // section keeps its shape while /library takes over its role as the record.
  // The two reads are independent, so they go out together.
  const [generations, preferences] = await Promise.all([
    listGenerationsForUser(userId, 6),
    getPreferencesForOwner(userId),
  ]);

  // Resolved through the catalog, so a stored value that has since left the
  // closed list falls back field by field instead of rendering an option that
  // no longer exists.
  const initialChoice = resolveGenerationChoice(
    preferences
      ? {
          model: preferences.defaultModel,
          size: preferences.defaultSize,
          count: preferences.defaultCount,
        }
      : null,
  );

  return (
    <Container className="py-16 md:py-24">
      <GeneratorWorkspace
        initialChoice={initialChoice}
        initialPublish={preferences?.defaultVisibility === "public"}
        initialGenerations={generations.map((generation) => ({
          id: generation.id,
          prompt: generation.prompt,
          imageUrl: generation.imageUrl,
          width: generation.width,
          height: generation.height,
          visibility: generation.visibility,
          createdAt: generation.createdAt.toISOString(),
        }))}
      />
    </Container>
  );
}
