export function capitalizeWords(value: string) {
  return value.trim().replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) =>
    `${separator}${letter.toLocaleUpperCase()}`,
  )
}
