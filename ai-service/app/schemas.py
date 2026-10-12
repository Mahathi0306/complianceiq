from typing import Any, Optional

from pydantic import BaseModel, Field


class ContextRequest(BaseModel):
    context: dict[str, Any]


class GeneratedResponse(BaseModel):
    text: str
    model: str


class ExplainRiskRequest(BaseModel):
    customer: dict[str, Any]
    score: int
    level: str
    breakdown: list[dict[str, Any]] = Field(default_factory=list)


class ExplainRiskResponse(BaseModel):
    text: str


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    context: Optional[dict[str, Any]] = None


class Source(BaseModel):
    title: str
    snippet: str


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]


class ExtractRequest(BaseModel):
    kind: str
    mimeType: str
    imageBase64: str


class ExtractResponse(BaseModel):
    fields: dict[str, Any]
    confidence: float


class ParseQueryRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)


class ParseQueryResponse(BaseModel):
    severity: Optional[str] = None
    ruleType: Optional[str] = None
    status: Optional[str] = None
    days: Optional[int] = None
