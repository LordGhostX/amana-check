export interface TextChunk {
  ordinal: number;
  content: string;
  page: number | null;
  anchor: string | null;
}

export interface ChunkOptions {
  targetChars?: number;
  overlapChars?: number;
  maxChunks?: number;
}

function splitLongParagraph(paragraph: string, target: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > target) {
      pieces.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const target = options.targetChars ?? 900;
  const overlap = options.overlapChars ?? 150;
  const maxChunks = options.maxChunks ?? 40;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const rawChunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const pieces =
      paragraph.length > target * 1.5
        ? splitLongParagraph(paragraph, target)
        : [paragraph];

    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > target) {
        rawChunks.push(current.trim());
        const tail = overlap > 0 ? current.slice(-overlap).trim() : "";
        current = tail ? `${tail} ${piece}` : piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }
  if (current.trim()) rawChunks.push(current.trim());

  return rawChunks.slice(0, maxChunks).map((content, ordinal) => ({
    ordinal,
    content,
    page: null,
    anchor: null,
  }));
}
