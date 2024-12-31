/**
 * defaultPatterns is a map of predefined regexps.
 * @description Characters that should be escaped: only [ \ ^ $ . | ? * + ( )
 */
export const defaultPatterns = {
  string: /^"(?:[^"\\]|\\.)*"$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}/,
  identifier: /^[A-Za-z0-9][A-Za-z0-9_]{3,}/, // FIXME
  username: /^[A-Za-z][A-Za-z0-9_]{5,}/, // FIXME
  /**
   * fullname matches a full name
   * @todo case insensitive modifier is not accepted by input pattern validation (missing uppercase unicode characters)
   */
  fullname:
    /^[A-Za-zàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð'-]{2,} [A-Za-zàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð'-]{1,}.*$/,
  email:
    /^(([^<>()\[\]\.,;:\s@"]+(\.[^<>()\[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i,
  ethaddr: /^0x[a-fA-F0-9]{40}$/,
  numbers: /^[0-9]+/,
  addrname: /^[A-Za-z][A-Za-z0-9_]{5,}/, // FIXME
  url: /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,10}(:[0-9]{1,5})?(\/.*)?$/,
  strictURL:
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/,
  //@todo chains
  contractid: (chains: string[]) =>
    new RegExp(`^[a-z][0-9a-z]*(_v[0-9a-z]+)?([_](${chains.join("|")}))?$`),
  orgid: /^[A-Za-z0-9][A-Za-z0-9_]{2,}/
} as const;

/**
 *   PatternType is either the name of a default pattern or a RegExp.
 */
export type PatternType = keyof typeof defaultPatterns | RegExp;
