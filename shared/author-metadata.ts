export enum AuthorGender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    UNKNOWN = 'UNKNOWN',
}

export enum AuthorRole {
    AUTHOR = 'AUTHOR',
    TRANSLATOR = 'TRANSLATOR',
    ILLUSTRATOR = 'ILLUSTRATOR',
    EDITOR = 'EDITOR',
    ARTIST = 'ARTIST',
    STORY = 'STORY',
    ADAPTATION = 'ADAPTATION',
}

export const AUTHOR_GENDER_VALUES = Object.values(AuthorGender);
export const AUTHOR_ROLE_VALUES = Object.values(AuthorRole);