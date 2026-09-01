import { PlatformRadarOperationPage } from "@/components/radar/radar-operation-page";

export const dynamic = "force-dynamic";

export default function BackofficeRadarOperationRoute() {
  return <PlatformRadarOperationPage basePath="/backoffice/radar" />;
}
