import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AutomationBucketName = "IMAGES" | "REELS";

export async function listMatchingBucketFiles(
  bucketName: AutomationBucketName,
  pattern: RegExp,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucketName).list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error || !data) {
    throw new Error(error?.message || `Could not read the ${bucketName} bucket.`);
  }

  return data
    .map((entry) => entry.name)
    .filter((name) => pattern.test(name))
    .sort((left, right) => left.localeCompare(right));
}

export function parseBucketSequenceNumber(fileName: string) {
  const match = fileName.match(/^(\d{1,3})\./i);

  if (!match) {
    return null;
  }

  const sequenceNumber = Number(match[1]);
  return sequenceNumber > 0 ? sequenceNumber : null;
}
