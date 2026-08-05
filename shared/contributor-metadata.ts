export enum ContributorGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNKNOWN = 'UNKNOWN',
}

export enum ContributorRole {
  AUTHOR = 'AUTHOR',
  TRANSLATOR = 'TRANSLATOR',
  ILLUSTRATOR = 'ILLUSTRATOR',
  EDITOR = 'EDITOR',
  CLEANER = 'CLEANER',
  TYPESETTER = 'TYPESETTER',
  RAW_PROVIDER = 'RAW_PROVIDER',
  SUPERVISOR = 'SUPERVISOR',
}

export const CONTRIBUTOR_GENDER_VALUES = Object.values(ContributorGender);
export const CONTRIBUTOR_ROLE_VALUES = Object.values(ContributorRole);

export const CONTRIBUTOR_ROLE_ICONS: Record<ContributorRole, string> = {
  [ContributorRole.AUTHOR]: 'author',
  [ContributorRole.TRANSLATOR]: 'translator',
  [ContributorRole.ILLUSTRATOR]: 'illustrator',
  [ContributorRole.EDITOR]: 'editor',
  [ContributorRole.CLEANER]: 'cleaner',
  [ContributorRole.TYPESETTER]: 'typesetter',
  [ContributorRole.RAW_PROVIDER]: 'rawProvider',
  [ContributorRole.SUPERVISOR]: 'supervisor',
};
