"""Build the small static data files from the supplied CSV and Census boundary ZIP.

Uses only Python's standard library. Run from the project root:
python3 scripts/build_data.py /path/to/election.csv /path/to/cb_2024_us_state_20m.zip
"""

import csv
import json
import struct
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
    "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
    "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}


def election_data(csv_path):
    with open(csv_path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = {}
        for row in reader:
            name = row["STATE"].strip()
            code = STATES[name]
            values = [float(row[key].strip().rstrip("%")) for key in ("D Vote", "R Vote ", "Other ")]
            if abs(sum(values) - 100) > 0.12:
                raise ValueError(f"Vote shares for {name} do not total about 100: {values}")
            rows[code] = {"name": name, "d": values[0], "r": values[1], "other": values[2]}
    if len(rows) != 51:
        raise ValueError(f"Expected 50 states and DC, found {len(rows)}")
    return rows


def dbf_names(raw):
    count = struct.unpack_from("<I", raw, 4)[0]
    header_size, record_size = struct.unpack_from("<HH", raw, 8)
    fields = []
    pos = 32
    offset = 1
    while raw[pos] != 13:
        name = raw[pos:pos + 11].split(b"\x00", 1)[0].decode("ascii")
        size = raw[pos + 16]
        fields.append((name, offset, size))
        offset += size
        pos += 32
    names = []
    for index in range(count):
        record = raw[header_size + index * record_size:header_size + (index + 1) * record_size]
        item = {name: record[start:start + size].decode("latin-1").strip() for name, start, size in fields}
        names.append(item["NAME"])
    return names


def project(lon, lat, code):
    if code == "AK":
        # Aleutian points west of the antimeridian are kept in a compact inset.
        if lon > 0:
            lon -= 360
        return (27 + (lon + 180) * 3.4, 440 + (72 - lat) * 4.9)
    if code == "HI":
        return (229 + (lon + 161) * 11, 485 + (23 - lat) * 12)
    return (48 + (lon + 125) * 13.0, 18 + (50 - lat) * 16.0)


def shape_paths(raw, names):
    paths = {}
    pos = 100
    index = 0
    while pos < len(raw):
        size = struct.unpack_from(">I", raw, pos + 4)[0] * 2
        body = raw[pos + 8:pos + 8 + size]
        name = names[index]
        index += 1
        pos += 8 + size
        if name not in STATES:
            continue
        code = STATES[name]
        if struct.unpack_from("<I", body, 0)[0] != 5:
            continue
        part_count, point_count = struct.unpack_from("<II", body, 36)
        starts = list(struct.unpack_from(f"<{part_count}I", body, 44)) + [point_count]
        point_offset = 44 + part_count * 4
        commands = []
        for part in range(part_count):
            coords = []
            for point in range(starts[part], starts[part + 1]):
                lon, lat = struct.unpack_from("<dd", body, point_offset + point * 16)
                x, y = project(lon, lat, code)
                coords.append(f"{x:.1f},{y:.1f}")
            if coords:
                commands.append("M" + "L".join(coords) + "Z")
        paths[code] = "".join(commands)
    if len(paths) != 51:
        raise ValueError(f"Expected 51 map shapes, found {len(paths)}")
    return paths


def main():
    csv_path, zip_path = sys.argv[1:3]
    election = election_data(csv_path)
    with zipfile.ZipFile(zip_path) as archive:
        stem = "cb_2024_us_state_20m"
        names = dbf_names(archive.read(stem + ".dbf"))
        paths = shape_paths(archive.read(stem + ".shp"), names)
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "election-2024.json").write_text(json.dumps(election, separators=(",", ":")))
    (ROOT / "data" / "state-paths.json").write_text(json.dumps(paths, separators=(",", ":")))


if __name__ == "__main__":
    main()
