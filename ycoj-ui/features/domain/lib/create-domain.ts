/** Backend `Types.DomainId`: `[a-zA-Z]\w{3,31}`. */
export const DOMAIN_ID_PATTERN = /^[a-zA-Z]\w{3,31}$/;

export type CreateDomainValues = {
  id: string;
  name: string;
  bulletin: string;
  avatar: string;
};

export type CreateDomainErrors = Partial<
  Record<keyof CreateDomainValues, string>
>;

export type CreateDomainMessages = {
  invalidId: string;
  invalidName: string;
  invalidBulletin: string;
};

export function validateCreateDomain(
  values: CreateDomainValues,
  messages: CreateDomainMessages
): CreateDomainErrors {
  const errors: CreateDomainErrors = {};
  if (!DOMAIN_ID_PATTERN.test(values.id.trim())) errors.id = messages.invalidId;
  if (!values.name.trim()) errors.name = messages.invalidName;
  if (!values.bulletin.trim()) errors.bulletin = messages.invalidBulletin;
  return errors;
}

/** Trims user input and drops the optional avatar when blank. */
export function buildCreateDomainPayload(values: CreateDomainValues) {
  return {
    id: values.id.trim(),
    name: values.name.trim(),
    bulletin: values.bulletin.trim(),
    ...(values.avatar.trim() ? { avatar: values.avatar.trim() } : {}),
  };
}
