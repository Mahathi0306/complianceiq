import math
import re
from collections import Counter
from pathlib import Path

TOKEN = re.compile(r"[a-z0-9]+")
STOP = {
    "the", "and", "for", "are", "with", "that", "this", "from", "have", "has", "not", "but", "can", "any",
    "when", "into", "than", "then", "its", "their", "should", "must", "will", "which", "what", "how", "does",
}


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if len(t) > 2 and t not in STOP]


class Retriever:
    def __init__(self, directory: str) -> None:
        self.chunks: list[dict] = []
        for path in sorted(Path(directory).glob("*.md")):
            self._load(path)
        document_frequency: Counter = Counter()
        for chunk in self.chunks:
            chunk["tokens"] = tokenize(chunk["title"] + " " + chunk["text"])
            document_frequency.update(set(chunk["tokens"]))
        total = len(self.chunks)
        self.idf = {term: math.log((1 + total) / (1 + count)) + 1 for term, count in document_frequency.items()}
        for chunk in self.chunks:
            chunk["vector"] = self._vector(chunk["tokens"])

    def _load(self, path: Path) -> None:
        document_title = path.stem.replace("-", " ").title()
        sections = re.split(r"^## ", path.read_text(encoding="utf-8"), flags=re.MULTILINE)
        for section in sections[1:]:
            heading, _, body = section.partition("\n")
            text = body.strip()
            if text:
                self.chunks.append({"title": f"{document_title}: {heading.strip()}", "text": text})

    def _vector(self, tokens: list[str]) -> dict[str, float]:
        weights = {term: (1 + math.log(n)) * self.idf.get(term, 0.0) for term, n in Counter(tokens).items()}
        norm = math.sqrt(sum(w * w for w in weights.values()))
        return {term: w / norm for term, w in weights.items()} if norm else {}

    def search(self, query: str, limit: int = 3) -> list[dict]:
        query_vector = self._vector(tokenize(query))
        scored = []
        for chunk in self.chunks:
            score = sum(weight * chunk["vector"].get(term, 0.0) for term, weight in query_vector.items())
            if score > 0:
                scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            {"title": chunk["title"], "snippet": chunk["text"], "score": round(score, 4)}
            for score, chunk in scored[:limit]
        ]
