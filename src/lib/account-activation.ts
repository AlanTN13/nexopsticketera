export const MINIMUM_PASSWORD_LENGTH = 12;

export function getPasswordValidationError(password: string, confirmation: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`;
  }

  if (password !== confirmation) {
    return "Las contraseñas no coinciden.";
  }

  return null;
}
