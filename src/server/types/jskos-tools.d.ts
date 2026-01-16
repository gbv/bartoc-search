declare module "jskos-tools" {
  /** The shape of each entry in objectTypes */
  interface ObjectTypeDef {
    type?: string[];
  }

  /** The exported lookup table */
  export const objectTypes: Record<string, ObjectTypeDef>;
}
