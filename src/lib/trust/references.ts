import type { AnswerPayload, EvidenceItem } from "@/lib/trust/types";

export interface ReferencedEvidence {
  item: EvidenceItem;
  number: number;
}

export interface EvidenceReferences {
  items: ReferencedEvidence[];
  numberByCitation: Map<number, number>;
}

const CITATION_RE = /\[S(\d+)\]/g;

function citationRefs(value: string): number[] {
  return Array.from(value.matchAll(CITATION_RE), (match) => Number(match[1]));
}

export function getEvidenceReferences(
  payload: AnswerPayload,
): EvidenceReferences {
  const items: ReferencedEvidence[] = [];
  const numberByCitation = new Map<number, number>();
  const numberByDocument = new Map<string, number>();
  const findings = [...payload.whatWeKnow, ...payload.whatWeDontKnow];

  for (const citation of findings.flatMap(citationRefs)) {
    const item = payload.evidence[citation - 1];
    if (!item) continue;

    let number = numberByDocument.get(item.documentId);
    if (number === undefined) {
      number = items.length + 1;
      numberByDocument.set(item.documentId, number);
      items.push({ item, number });
    }
    numberByCitation.set(citation, number);
  }

  return { items, numberByCitation };
}
