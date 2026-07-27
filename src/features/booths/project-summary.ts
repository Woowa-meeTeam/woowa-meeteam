const summaryLimit = 260

export function summarizeProjectDescription(markdown: string): string {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, " ")
    .replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+\.)\s+/gm, "")
    .replace(/[*_~`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (plainText.length <= summaryLimit) {
    return plainText
  }

  const shortened = plainText.slice(0, summaryLimit)
  const lastSpace = shortened.lastIndexOf(" ")
  return `${shortened.slice(0, lastSpace > 180 ? lastSpace : summaryLimit).trim()}…`
}
