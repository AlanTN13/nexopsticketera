export const REQUIRED_USER_TITLE_MESSAGE = "Ingresá el cargo del usuario.";

export function requireUserTitle(value: string) {
  const title = value.trim();

  if (!title) {
    throw new Error(REQUIRED_USER_TITLE_MESSAGE);
  }

  return title;
}
