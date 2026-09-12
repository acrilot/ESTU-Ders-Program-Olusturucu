import json
import unittest

class TestParser(unittest.TestCase):
    def setUp(self):
        with open("courses_data.json", "r", encoding="utf-8") as f:
            self.catalog = json.load(f)

    def test_departments_exist(self):
        dept_codes = [d["code"] for d in self.catalog["departments"]]
        for expected in ["HEE", "UGMB", "HY", "HTK", "PLT"]:
            self.assertIn(expected, dept_codes, f"Expected department {expected} not found")

    def test_target_courses_hee_7(self):
        # Look for HEE 7. Yarıyıl courses from user's image
        hee = next((d for d in self.catalog["departments"] if d["code"] == "HEE"), None)
        self.assertIsNotNone(hee)
        sem7 = next((s for s in hee["semesters"] if "7. Yarıyıl" in s["label"]), None)
        self.assertIsNotNone(sem7)
        codes = [c["code"] for c in sem7["courses"]]
        
        expected_courses = ["HEE4007", "HEE4009", "HEE421", "HEE423"]
        for exp in expected_courses:
            self.assertIn(exp, codes, f"Expected course {exp} missing in HEE 7. Yarıyıl")

    def test_course_group_slots(self):
        # Check HEE2005 group A has slots on Pzt and Sal
        all_courses = self.catalog["all_courses"]
        hee2005_a = next((c for c in all_courses if c["code"] == "HEE2005" and c["group"] == "A"), None)
        self.assertIsNotNone(hee2005_a)
        self.assertEqual(len(hee2005_a["time_slots"]), 2)
        days = [slot["day"] for slot in hee2005_a["time_slots"]]
        self.assertIn("Pzt", days)
        self.assertIn("Sal", days)

if __name__ == "__main__":
    unittest.main()

