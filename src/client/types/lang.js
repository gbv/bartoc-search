import SUPPORTED_LANGUAGES from "../../../data/supported_languages.json"

/**
 * @readonly
 * @enum {string}
 */

export const SupportedLang = Object.freeze(
  Object.fromEntries(
    // for each language code, make an [UPPER, lower] pair
    Object.keys(SUPPORTED_LANGUAGES).map(code => [
      code.toUpperCase(),
      code,
    ]),
  ),
)


/**
 * @typedef {keyof typeof SupportedLang} SupportedLangKey
 */