export function withActor(path: string, actorId: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}actor=${encodeURIComponent(actorId)}`;
}
