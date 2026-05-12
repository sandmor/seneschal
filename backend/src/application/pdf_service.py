from __future__ import annotations

import io
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _parse_markdown_lines(content: str) -> list[tuple[str, str]]:
    """Parse markdown lines into (style, text) tuples."""
    result = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            result.append(("spacer", ""))
        elif stripped.startswith("### "):
            result.append(("Heading3", stripped[4:]))
        elif stripped.startswith("## "):
            result.append(("Heading2", stripped[3:]))
        elif stripped.startswith("# "):
            result.append(("Heading1", stripped[2:]))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            result.append(("Normal", f"• {stripped[2:]}"))
        elif re.match(r"^\d+\. ", stripped):
            result.append(("Normal", re.sub(r"^\d+\. ", "", stripped)))
        else:
            text = re.sub(r"\*\*(.*?)\*\*", r"\1", stripped)
            text = re.sub(r"\*(.*?)\*", r"\1", text)
            text = re.sub(r"`(.*?)`", r"\1", text)
            result.append(("Normal", text))
    return result


def generate_pdf(content: str, title: str = "Document") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(title, styles["Title"]))
    story.append(Spacer(1, 0.5 * cm))

    for style, text in _parse_markdown_lines(content):
        if style == "spacer":
            story.append(Spacer(1, 0.3 * cm))
        else:
            story.append(Paragraph(text, styles[style]))

    doc.build(story)
    return buffer.getvalue()
