from __future__ import annotations

import markdown
from playwright.sync_api import sync_playwright


_BASE_CSS = """
    @page { margin: 2cm; }
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; }
    h1 { font-size: 2em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; margin-top: 0; }
    h2 { font-size: 1.5em; margin-top: 1em; }
    h3 { font-size: 1.2em; margin-top: 0.8em; }
    code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 1em; color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 6px 12px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    ul, ol { margin: 0.5em 0; }
    li { margin: 0.3em 0; }
"""


def generate_pdf(content: str, title: str = "Document") -> bytes:
    """Convert Markdown to HTML, then render to PDF using Playwright + Chromium."""
    body_html = markdown.markdown(
        content,
        extensions=["extra", "codehilite", "toc"],
    )

    full_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>{_BASE_CSS}</style>
</head>
<body>
  <h1>{title}</h1>
  {body_html}
</body>
</html>"""

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(full_html)
        pdf_bytes = page.pdf()
        browser.close()

    return pdf_bytes
