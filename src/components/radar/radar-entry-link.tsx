import Link from "next/link";
import type { ComponentProps } from "react";

export function isRadarEntry(href: string) {
  return /^\/(?:portal|backoffice)\/radar(?:[/?#]|$)/.test(href);
}

/** A document navigation applies Radar's scoped popup policy; SPA entry cannot. */
export default function RadarEntryLink(props: ComponentProps<"a"> & { href: string }) {
  if (isRadarEntry(props.href)) return <a {...props} />;
  return <Link {...props} href={props.href} />;
}
