import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Private object storage avoids the hosted function's response-size limit.
export function sermonPowerPointPath(churchId: string, documentId: string) {
  // A sermon has one downloadable deliverable.  Do not make a new object every
  // time the row's updatedAt value changes.
  return `${churchId}/${documentId}/final.pptx`;
}

async function removeOlderVersions(path: string) {
  const slash = path.lastIndexOf("/");
  if (slash < 0) return;
  const folder = path.slice(0, slash);
  const filename = path.slice(slash + 1);
  const storage = createSupabaseAdminClient().storage.from("crm-documents");
  const listed = await storage.list(folder, { limit: 1000 });
  if (listed.error) return;

  const obsolete = (listed.data || [])
    .filter((file) => file.name !== filename && /\.pptx$/i.test(file.name))
    .map((file) => `${folder}/${file.name}`);
  if (obsolete.length) await storage.remove(obsolete);
}

export async function storePrivateDocument(path: string, contentType: string, file: Buffer | Uint8Array) {
  const storage = createSupabaseAdminClient().storage.from("crm-documents");
  const upload = await storage.upload(path, file, { contentType, upsert: true });
  if (upload.error) throw new Error("Document storage is unavailable. Please try again.");
  // This also retires timestamped files created by the earlier download flow.
  await removeOlderVersions(path);
}

export async function privateDocumentUrl(path: string, filename: string, contentType: string, build: () => Promise<Buffer | Uint8Array>) {
  const storage = createSupabaseAdminClient().storage.from("crm-documents");
  let signed = await storage.createSignedUrl(path, 300, { download: filename });
  if (signed.error) {
    const file = await build();
    await storePrivateDocument(path, contentType, file);
    signed = await storage.createSignedUrl(path, 300, { download: filename });
  }
  if (signed.error || !signed.data?.signedUrl) throw new Error("Unable to prepare the private download.");
  return signed.data.signedUrl;
}
