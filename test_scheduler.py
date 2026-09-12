import json
import unittest
from scheduler import solve_schedules

class TestScheduler(unittest.TestCase):
    def setUp(self):
        with open("courses_data.json", "r", encoding="utf-8") as f:
            catalog = json.load(f)
        
        # Extract HEE 7. Yarıyıl courses
        hee = next(d for d in catalog["departments"] if d["code"] == "HEE")
        sem7 = next(s for s in hee["semesters"] if "7. Yarıyıl" in s["label"])
        
        target_codes = ["HEE4007", "HEE4009", "HEE421", "HEE423"]
        self.selected_courses = [c for c in sem7["courses"] if c["code"] in target_codes]
        self.assertEqual(len(self.selected_courses), 4)

    def test_default_solution_exists(self):
        criteria = {
            "allowed_days": ["Pzt", "Sal", "Crs", "Prs", "Cum"],
            "require_lunch": True,
            "lunch_min_hours": 0.5,
            "earliest_start": 8.0,
            "latest_end": 20.0,
            "allow_star1": False # default: only standard groups
        }
        solutions = solve_schedules(self.selected_courses, criteria)
        print(f"\n[Test] Found {len(solutions)} solutions for default criteria.")
        self.assertGreater(len(solutions), 0, "Should find at least one valid conflict-free schedule")
        best = solutions[0]
        print(f"[Test] Best schedule score: {best['metrics']['efficiency_score']}, active days: {best['metrics']['active_days_count']}")
        for g in best["groups"]:
            times = ", ".join([f"{s['day']} {s['display']}" for s in g['time_slots']])
            print(f"  - {g['code']} ({g['group']}): {times}")

    def test_allow_star1_increases_or_preserves_solutions(self):
        criteria_standard = {
            "allowed_days": ["Pzt", "Sal", "Crs", "Prs", "Cum"],
            "require_lunch": True,
            "lunch_min_hours": 0.5,
            "allow_star1": False
        }
        criteria_with_stars = {
            "allowed_days": ["Pzt", "Sal", "Crs", "Prs", "Cum"],
            "require_lunch": True,
            "lunch_min_hours": 0.5,
            "allow_star1": True
        }
        sols1 = solve_schedules(self.selected_courses, criteria_standard)
        sols2 = solve_schedules(self.selected_courses, criteria_with_stars)
    def test_c_group_prioritized_over_d_group(self):
        # When star1 is enabled, verify that schedules using group C rank higher than identical schedules using group D
        criteria_with_stars = {
            "allowed_days": ["Pzt", "Sal", "Crs", "Prs", "Cum"],
            "require_lunch": False,
            "earliest_start": 8.0,
            "latest_end": 20.0,
            "allow_star1": True
        }
        solutions = solve_schedules(self.selected_courses, criteria_with_stars, max_results=50)
        self.assertGreater(len(solutions), 0)

        # Find first solution using group C and first using group D for HEE4009
        idx_c = None
        idx_d = None
        for i, sol in enumerate(solutions):
            for g in sol["groups"]:
                if g["code"] == "HEE4009":
                    if g["group"] == "C" and idx_c is None:
                        idx_c = i
                    elif g["group"] == "D" and idx_d is None:
                        idx_d = i
        
        if idx_c is not None and idx_d is not None:
            print(f"[Test] First occurrence of C group at index {idx_c}, D group at index {idx_d}")
            self.assertLess(idx_c, idx_d, "Group C should appear before Group D in ranked solutions")

if __name__ == "__main__":
    unittest.main()

