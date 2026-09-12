import unittest
import json
from app import app

class TestWebApp(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_index_route(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"EST", res.data)

    def test_catalog_route(self):
        res = self.client.get("/api/catalog")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("departments", data)
        self.assertGreater(len(data["departments"]), 0)

    def test_solve_api_endpoint(self):
        # Fetch catalog first
        cat_res = self.client.get("/api/catalog")
        catalog = cat_res.get_json()
        hee = next(d for d in catalog["departments"] if d["code"] == "HEE")
        sem7 = next(s for s in hee["semesters"] if "7. Yarıyıl" in s["label"])
        selected = [c for c in sem7["courses"] if c["code"] in ["HEE4007", "HEE4009", "HEE421", "HEE423"]]

        payload = {
            "courses": selected,
            "criteria": {
                "allowed_days": ["Pzt", "Sal", "Crs", "Prs", "Cum"],
                "require_lunch": True,
                "lunch_min_hours": 0.5,
                "earliest_start": 8.0,
                "latest_end": 20.0,
                "allow_star1": False
            }
        }
        res = self.client.post("/api/solve", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("schedules", data)
        self.assertGreater(len(data["schedules"]), 0)
        print(f"\n[Test API] Successfully generated {len(data['schedules'])} schedules via /api/solve")

    def test_upload_pdf_endpoint(self):
        import io
        # Test no file
        res1 = self.client.post("/api/upload-pdf")
        self.assertEqual(res1.status_code, 400)

        # Test non-pdf file
        data = {"file": (io.BytesIO(b"fake txt content"), "test.txt")}
        res2 = self.client.post("/api/upload-pdf", data=data, content_type="multipart/form-data")
        self.assertEqual(res2.status_code, 400)

        # Test valid PDF upload
        import os
        pdf_path = "2026-2027 Güz Ders Programı.pdf"
        if os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                data = {"file": (io.BytesIO(f.read()), "2026-2027 Güz Ders Programı.pdf")}
                res3 = self.client.post("/api/upload-pdf", data=data, content_type="multipart/form-data")
                self.assertEqual(res3.status_code, 200)
                res_data = res3.get_json()
                self.assertTrue(res_data.get("success"))
                self.assertGreater(res_data.get("course_count", 0), 400)
                print(f"[Test Upload API] Successfully parsed uploaded PDF with {res_data['course_count']} courses")

if __name__ == "__main__":
    unittest.main()

