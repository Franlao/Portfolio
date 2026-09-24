import { atom } from "nanostores";

/** What the site was checked against, shown in the header cartouche. Shared between islands. */
export const $verifiedFor = atom<string | null>(null);
