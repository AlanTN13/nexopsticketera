import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;
  const client = await getSupabaseServerClient();
  const { data: attachment, error } = await client
    .from("ticket_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error || !attachment?.storage_path || attachment.storage_path.startsWith("seed/")) {
    return new NextResponse("Adjunto no disponible.", { status: 404 });
  }

  const { data, error: signedUrlError } = await client.storage
    .from("ticket-attachments")
    .createSignedUrl(attachment.storage_path, 30);

  if (signedUrlError || !data?.signedUrl) {
    return new NextResponse("Adjunto no disponible.", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
