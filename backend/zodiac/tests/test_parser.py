from django.test import SimpleTestCase

from zodiac.parsers.chart_export_v1 import parse_chart_export_v1


MINIMAL_CHART = """
Sun	11°37'		Libra
Moon	26°33'		Sagittarius
AS	28°17'		Pisces
House 1	28°17'	Pisces
House 2	13°11'	Taurus
House 3	9°11'	Gemini
House 4	29°13'	Gemini
House 5	19°07'	Cancer
House 6	14°34'	Leo
House 7	28°17'	Virgo
House 8	13°11'	Scorpio
House 9	9°11'	Sagittarius
House 10	29°13'	Sagittarius
House 11	19°07'	Capricorn
House 12	14°34'	Aquarius
"""


class ChartExportParserTests(SimpleTestCase):
    def test_parses_minimal_positions_and_cusps(self):
        chart, warnings = parse_chart_export_v1(MINIMAL_CHART)
        self.assertEqual(chart["points"]["sun"]["sign"], "libra")
        self.assertEqual(chart["points"]["moon"]["sign"], "sagittarius")
        self.assertEqual(chart["angles"]["ascendant"]["sign"], "pisces")
        self.assertEqual(len(chart["houses"]["cusps_longitude_deg"]), 12)
        self.assertEqual(chart["schema_version"], 1)

    def test_parses_body_house_when_second_column_is_house_n(self):
        """Exports like `Sun\tHouse 7` (one cell `House 7`, not three columns)."""
        text = (
            MINIMAL_CHART
            + """
Sun	House 7
Moon	House 9
"""
        )
        chart, warnings = parse_chart_export_v1(text)
        unrecognized = [w for w in warnings if w.startswith("Unrecognized line")]
        self.assertEqual(unrecognized, [])
        self.assertEqual(chart["points"]["sun"]["house"], 7)
        self.assertEqual(chart["points"]["moon"]["house"], 9)

    def test_decimal_sign_longitude_optional_house_column(self):
        """Many apps export Body \\t Sign \\t longitude \\t house in one table."""
        lines = MINIMAL_CHART.strip().splitlines()
        head = [
            "Sun\tlibra\t191.62\t7",
            "Moon\tsagittarius\t266.55\t9",
        ]
        text = "\n".join(head + lines[2:])
        chart, warnings = parse_chart_export_v1(text)
        unrecognized = [w for w in warnings if w.startswith("Unrecognized line")]
        self.assertEqual(unrecognized, [])
        self.assertAlmostEqual(chart["points"]["sun"]["longitude_deg"], 191.62, places=2)
        self.assertEqual(chart["points"]["sun"]["sign"], "libra")
        self.assertEqual(chart["points"]["sun"]["house"], 7)
        self.assertEqual(chart["points"]["moon"]["house"], 9)

    def test_skips_spreadsheet_header_row(self):
        lines = MINIMAL_CHART.strip().splitlines()
        text = "\n".join(
            [
                "Body\tSign\tLongitude °\tHouse",
                "Sun\tlibra\t191.62\t7",
                "Moon\tsagittarius\t266.55\t9",
            ]
            + lines[2:],
        )
        chart, warnings = parse_chart_export_v1(text)
        hdr_warns = [w for w in warnings if "Unrecognized" in w and "Body" in w]
        self.assertEqual(hdr_warns, [])
        self.assertEqual(chart["points"]["sun"]["house"], 7)

    def test_north_node_and_part_of_fortune_aliases(self):
        text = (
            MINIMAL_CHART
            + """
North Node\tcancer\t118.53\t10
Part Of Fortune\tgemini\t73.23
"""
        )
        chart, _ = parse_chart_export_v1(text)
        self.assertIn("north_node", chart["points"])
        self.assertEqual(chart["points"]["north_node"]["house"], 10)
        self.assertIn("part_of_fortune", chart["points"])

    def test_vertical_aspect_orb_without_trailing_quote(self):
        """Some exports omit the minute quote on orb (e.g. `10°28` vs `10°28'`)."""
        text = (
            MINIMAL_CHART
            + """
Sun
Opposite
Jupiter
Orb
10°28
"""
        )
        chart, warnings = parse_chart_export_v1(text)
        unrecognized = [w for w in warnings if w.startswith("Unrecognized line")]
        self.assertEqual(unrecognized, [])
        self.assertEqual(len(chart["aspects"]), 1)
        self.assertEqual(chart["aspects"][0]["type"], "opposition")
        self.assertAlmostEqual(chart["aspects"][0]["orb_deg"], 10 + 28 / 60.0, places=4)

    def test_vertical_multiline_export(self):
        """One field per line (common copy/paste) normalizes to the tabbed layout."""
        text = """
Sun
11°37'
Libra
Moon
26°33'
Sagittarius
AS
28°17'
Pisces
House 1
28°17'
Pisces
House 2
13°11'
Taurus
House 3
9°11'
Gemini
House 4
29°13'
Gemini
House 5
19°07'
Cancer
House 6
14°34'
Leo
House 7
28°17'
Virgo
House 8
13°11'
Scorpio
House 9
9°11'
Sagittarius
House 10
29°13'
Sagittarius
House 11
19°07'
Capricorn
House 12
14°34'
Aquarius
Sun
Conjunction
Saturn
Orb
1°03'
"""
        chart, warnings = parse_chart_export_v1(text)
        unrecognized = [w for w in warnings if w.startswith("Unrecognized line")]
        self.assertEqual(unrecognized, [])
        self.assertEqual(chart["points"]["sun"]["sign"], "libra")
        self.assertEqual(chart["angles"]["ascendant"]["sign"], "pisces")
        self.assertEqual(len(chart["houses"]["cusps_longitude_deg"]), 12)
        self.assertEqual(len(chart["aspects"]), 1)
        self.assertEqual(chart["aspects"][0]["type"], "conjunction")

    def test_vertical_aspect_inconjunction_and_sesqui_quadrate(self):
        """Exports label quincunx as Inconjunction; sesquisquare as SesquiQuadrate."""
        text = (
            MINIMAL_CHART
            + """
Moon
Inconjunction
MC
Orb
0°54'
Mars
SesquiQuadrate
MC
Orb
2°06'
"""
        )
        chart, warnings = parse_chart_export_v1(text)
        unrecognized = [w for w in warnings if w.startswith("Unrecognized line")]
        self.assertEqual(unrecognized, [])
        types = [a["type"] for a in chart["aspects"]]
        self.assertEqual(types, ["quincunx", "sesqui_square"])
        self.assertEqual(chart["aspects"][0]["body_a"], "moon")
        self.assertEqual(chart["aspects"][0]["body_b"], "midheaven")

    def test_opposite_aspect_alias(self):
        """Some apps export opposition aspects as 'Opposite' instead of 'Opposition'."""
        text = MINIMAL_CHART + "\nUranus\tOpposite\tMC\tOrb\t2°02'\n"
        chart, warnings = parse_chart_export_v1(text)
        unk_aspect = [w for w in warnings if "Unknown aspect type" in w]
        self.assertEqual(unk_aspect, [])
        self.assertEqual(len(chart["aspects"]), 1)
        self.assertEqual(chart["aspects"][0]["type"], "opposition")
        self.assertEqual(chart["aspects"][0]["body_a"], "uranus")
        self.assertEqual(chart["aspects"][0]["body_b"], "midheaven")

    def test_space_separated_sections_and_warnings_suffix(self):
        """Real-world messy paste: headings, footnote, space-separated rows, '//' suffix."""
        text = """
Planets in Houses*
Sun 14°10' Leo
Moon 17°30' Leo
AS 27°01' Libra

* In keeping with the common practice, we consider that a planet posited within 1 degree...

Positions of Houses
House 1 27°01' Libra
House 2 24°59' Scorpio
House 3 27°10' Sagittarius
House 4 2°05' Aquarius
House 5 5°21' Pisces
House 6 3°47' Aries
House 7 27°01' Aries
House 8 24°59' Taurus
House 9 27°10' Gemini
House 10 2°05' Leo
House 11 5°21' Virgo
House 12 3°47' Libra

Sun House 10
Moon House 10

List of Planetary Aspects
Neptune Conjunction AS Orb 0°50' // trailing paste
Saturn SemiSextile AS Orb 0°49'
"""
        chart, warnings = parse_chart_export_v1(text)
        unrecognized = [w for w in warnings if w.startswith("Unrecognized line")]
        self.assertEqual(unrecognized, [])
        self.assertEqual(chart["points"]["sun"]["sign"], "leo")
        self.assertEqual(chart["points"]["moon"]["house"], 10)
        self.assertEqual(chart["angles"]["ascendant"]["sign"], "libra")
        self.assertEqual(len(chart["houses"]["cusps_longitude_deg"]), 12)
        self.assertTrue(len(chart["aspects"]) >= 2)
