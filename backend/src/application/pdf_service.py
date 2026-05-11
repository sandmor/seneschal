from __future__ import annotations

import io
import re

import markdown
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def generate_pdf(content: str, title: str = "Document") -> bytes:
    html_body = markdown.markdown(content, extensions=["tables", "fenced_code"])
    lines = html_body.split("\n")

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

    for line in lines:
        line = line.strip()
        if not line:
            story.append(Spacer(1, 0.3 * cm))
            continue
        text = _strip_html(line)
        if not text:
            continue
        if line.startswith("<h1"):
            story.append(Paragraph(text, styles["Heading1"]))
        elif line.startswith("<h2"):
            story.append(Paragraph(text, styles["Heading2"]))
        elif line.startswith("<h3"):
            story.append(Paragraph(text, styles["Heading3"]))
        else:
            story.append(Paragraph(text, styles["Normal"]))

    doc.build(story)
    return buffer.getvalue()
