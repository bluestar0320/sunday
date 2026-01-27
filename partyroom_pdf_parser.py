#!/usr/bin/env python3
"""Parse party room sale PDFs into a structured table."""

from __future__ import annotations

import argparse
import csv
import importlib.util
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class ParsedListing:
    source_file: str
    location: str
    nearby_station: str
    walking_time: str
    premium: str
    monthly_rent: str
    maintenance_fee: str
    deposit: str
    floor: str
    max_capacity: str
    demand_scale: str
    pros: str
    cons: str
    image_files: str


FIELD_PATTERNS = {
    "location": [r"(?:위치|주소)\s*[:\-]?\s*(.+)"],
    "nearby_station": [r"(?:역세권|인근역|근처역|가까운\s*역)\s*[:\-]?\s*(.+)"],
    "walking_time": [r"(?:도보\s*거리|도보\s*시간|도보)\s*[:\-]?\s*([0-9]+\s*분)"],
    "premium": [r"권리금\s*[:\-]?\s*([0-9,\.]+\s*[^\s]*)"],
    "monthly_rent": [r"월세\s*[:\-]?\s*([0-9,\.]+\s*[^\s]*)"],
    "maintenance_fee": [r"관리비\s*[:\-]?\s*([0-9,\.]+\s*[^\s]*)"],
    "deposit": [r"보증금\s*[:\-]?\s*([0-9,\.]+\s*[^\s]*)"],
    "floor": [r"(?:층수|층)\s*[:\-]?\s*([0-9]+\s*[^\s]*)"],
    "max_capacity": [r"(?:최대\s*인원|수용\s*인원|최대\s*수용)\s*[:\-]?\s*([0-9]+\s*[^\s]*)"],
    "demand_scale": [r"(?:수요\s*규모|수요|타깃)\s*[:\-]?\s*(.+)"],
    "pros": [r"(?:장점|특장점|메리트)\s*[:\-]?\s*(.+)"],
    "cons": [r"(?:단점|유의사항)\s*[:\-]?\s*(.+)"],
}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def search_patterns(text: str, patterns: Iterable[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return normalize_text(match.group(1))
    return ""


def extract_text_with_pdfplumber(pdf_path: Path) -> str:
    import pdfplumber

    texts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text:
                texts.append(page_text)
    return "\n".join(texts)


def extract_images_with_pdfplumber(pdf_path: Path, images_dir: Path) -> list[str]:
    import pdfplumber

    images_dir.mkdir(parents=True, exist_ok=True)
    saved_files: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            for image_index, image in enumerate(page.images, start=1):
                bbox = (image["x0"], image["top"], image["x1"], image["bottom"])
                cropped = page.crop(bbox)
                image_object = cropped.to_image(resolution=150)
                filename = f"{pdf_path.stem}_p{page_number}_img{image_index}.png"
                file_path = images_dir / filename
                image_object.save(file_path)
                saved_files.append(str(file_path))
    return saved_files


def extract_text_with_pypdf(pdf_path: Path) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(str(pdf_path))
    texts = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text:
            texts.append(page_text)
    return "\n".join(texts)


def extract_images_with_pymupdf(pdf_path: Path, images_dir: Path) -> list[str]:
    import fitz

    images_dir.mkdir(parents=True, exist_ok=True)
    saved_files: list[str] = []
    document = fitz.open(pdf_path)
    for page_index in range(len(document)):
        page = document[page_index]
        images = page.get_images(full=True)
        for image_index, image in enumerate(images, start=1):
            xref = image[0]
            base_image = document.extract_image(xref)
            image_bytes = base_image["image"]
            ext = base_image["ext"]
            filename = f"{pdf_path.stem}_p{page_index + 1}_img{image_index}.{ext}"
            file_path = images_dir / filename
            with open(file_path, "wb") as image_file:
                image_file.write(image_bytes)
            saved_files.append(str(file_path))
    document.close()
    return saved_files


def extract_text(pdf_path: Path) -> str:
    if importlib.util.find_spec("pdfplumber"):
        return extract_text_with_pdfplumber(pdf_path)
    if importlib.util.find_spec("PyPDF2"):
        return extract_text_with_pypdf(pdf_path)
    raise RuntimeError("pdfplumber 또는 PyPDF2 라이브러리가 필요합니다.")


def extract_images(pdf_path: Path, images_dir: Path) -> list[str]:
    if importlib.util.find_spec("pdfplumber"):
        return extract_images_with_pdfplumber(pdf_path, images_dir)
    if importlib.util.find_spec("fitz"):
        return extract_images_with_pymupdf(pdf_path, images_dir)
    return []


def parse_listing(pdf_path: Path, images_dir: Path) -> ParsedListing:
    text = extract_text(pdf_path)
    normalized_text = normalize_text(text)
    images = extract_images(pdf_path, images_dir)

    extracted = {key: search_patterns(normalized_text, patterns) for key, patterns in FIELD_PATTERNS.items()}

    return ParsedListing(
        source_file=str(pdf_path),
        location=extracted["location"],
        nearby_station=extracted["nearby_station"],
        walking_time=extracted["walking_time"],
        premium=extracted["premium"],
        monthly_rent=extracted["monthly_rent"],
        maintenance_fee=extracted["maintenance_fee"],
        deposit=extracted["deposit"],
        floor=extracted["floor"],
        max_capacity=extracted["max_capacity"],
        demand_scale=extracted["demand_scale"],
        pros=extracted["pros"],
        cons=extracted["cons"],
        image_files=";".join(images),
    )


def write_csv(output_path: Path, listings: Iterable[ParsedListing]) -> None:
    fieldnames = [
        "source_file",
        "location",
        "nearby_station",
        "walking_time",
        "premium",
        "monthly_rent",
        "maintenance_fee",
        "deposit",
        "floor",
        "max_capacity",
        "demand_scale",
        "pros",
        "cons",
        "image_files",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for listing in listings:
            writer.writerow({key: getattr(listing, key) for key in fieldnames})


def write_markdown(output_path: Path, listings: Iterable[ParsedListing]) -> None:
    headers = [
        "source_file",
        "location",
        "nearby_station",
        "walking_time",
        "premium",
        "monthly_rent",
        "maintenance_fee",
        "deposit",
        "floor",
        "max_capacity",
        "demand_scale",
        "pros",
        "cons",
        "image_files",
    ]
    rows = [headers]
    for listing in listings:
        rows.append([getattr(listing, header) or "" for header in headers])

    with open(output_path, "w", encoding="utf-8") as markdown_file:
        markdown_file.write("| " + " | ".join(headers) + " |\n")
        markdown_file.write("|" + "|".join([" --- "] * len(headers)) + "|\n")
        for row in rows[1:]:
            markdown_file.write("| " + " | ".join(row) + " |\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="파티룸 매물 PDF에서 정보를 추출해 표로 정리합니다.",
    )
    parser.add_argument("pdf_paths", nargs="+", help="PDF 파일 경로")
    parser.add_argument("--output", default="partyroom_summary.csv", help="CSV 결과 파일 경로")
    parser.add_argument("--markdown", default="partyroom_summary.md", help="Markdown 결과 파일 경로")
    parser.add_argument("--images-dir", default="partyroom_images", help="이미지 저장 폴더")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_paths = [Path(path) for path in args.pdf_paths]
    images_dir = Path(args.images_dir)

    listings = [parse_listing(pdf_path, images_dir) for pdf_path in pdf_paths]

    write_csv(Path(args.output), listings)
    write_markdown(Path(args.markdown), listings)

    print(f"CSV 저장 완료: {args.output}")
    print(f"Markdown 저장 완료: {args.markdown}")
    if images_dir.exists():
        print(f"이미지 저장 폴더: {images_dir}")


if __name__ == "__main__":
    main()
