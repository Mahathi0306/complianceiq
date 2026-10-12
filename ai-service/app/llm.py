import json
import logging
import os
import re
from typing import Any, Optional

logger = logging.getLogger("llm")

DEFAULT_MODEL = "claude-sonnet-5-5"


class Llm:
    def __init__(self) -> None:
        self.model = os.getenv("AI_MODEL", DEFAULT_MODEL)
        key = os.getenv("ANTHROPIC_API_KEY")
        self._client = None
        if key:
            from anthropic import Anthropic

            self._client = Anthropic(api_key=key, timeout=float(os.getenv("LLM_TIMEOUT", "30")))

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def complete(self, system: str, content: Any, max_tokens: int = 900) -> str:
        message = self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": content}],
        )
        return "".join(block.text for block in message.content if block.type == "text").strip()


def parse_json_object(text: str) -> Optional[dict]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        value = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None
