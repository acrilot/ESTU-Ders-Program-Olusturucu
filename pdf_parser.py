import re
import json
import fitz  # PyMuPDF

DAY_COL_INDEXES = {
    4: {"key": "Pzt", "name": "Pazartesi", "day_idx": 0},
    5: {"key": "Sal", "name": "Salı", "day_idx": 1},
    6: {"key": "Crs", "name": "Çarşamba", "day_idx": 2},
    7: {"key": "Prs", "name": "Perşembe", "day_idx": 3},
    8: {"key": "Cum", "name": "Cuma", "day_idx": 4},
    9: {"key": "Crt", "name": "Cumartesi", "day_idx": 5},
}

SEMESTER_MAP = {
    "1": "1. Yarıyıl (Güz)",
    "2": "3. Yarıyıl (Güz)",
    "3": "5. Yarıyıl (Güz)",
    "4": "7. Yarıyıl (Güz)"
}

DEPARTMENT_MAP = {
    "HEE": "Havacılık Elektrik ve Elektroniği",
    "UGMB": "Uçak Gövde ve Motor Bakımı",
    "HY": "Havacılık Yönetimi",
    "HTK": "Hava Trafik Kontrolü",
    "PLT": "Pilotaj",
    "HUM": "Havacılık ve Uzay Mühendisliği / Ortak",
    "Rektörlük Seçmeli": "Rektörlük / Ortak Seçmeli Dersler",
    "ORTAK": "Ortak / Seçmeli Dersler"
}

def parse_time_slot(time_str):
    """
    Parses strings like '12-14', '09-12', '09:00-12:00', '09.00-12.00'
    Returns (start_float, end_float, display_str) or None
    """
    time_str = time_str.strip()
    # Case 1: 9-12 or 09-12
    m1 = re.match(r'^(\d{1,2})-(\d{1,2})$', time_str)
    if m1:
        start = float(m1.group(1))
        end = float(m1.group(2))
        return start, end, f"{int(start):02d}:00 - {int(end):02d}:00"
    
    # Case 2: 09:00-12:00 or 09.00-12.00 or 08:30-10:00
    m2 = re.match(r'^(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})$', time_str)
    if m2:
        start = float(m2.group(1)) + float(m2.group(2)) / 60.0
        end = float(m2.group(3)) + float(m2.group(4)) / 60.0
        return start, end, f"{int(m2.group(1)):02d}:{m2.group(2)} - {int(m2.group(3)):02d}:{m2.group(4)}"
    return None

def parse_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    all_courses = []
    
    current_section = ""
    
    for page_idx, page in enumerate(doc):
        tab_finder = page.find_tables()
        for tab in tab_finder.tables:
            rows = tab.extract()
            for r in rows:
                if not r or len(r) < 17:
                    continue
                
                # Check for header rows or non-course title rows
                c0 = str(r[0]).strip() if r[0] else ""
                c1 = str(r[1]).strip() if r[1] else ""
                c2 = str(r[2]).strip() if r[2] else ""
                
                if c1 in ['D.Kodu', ''] and c2 in ['Dersin Adı', '']:
                    continue
                if 'HAVACILIK' in c1 or 'AÇIKLAMALAR' in c1 or 'AÇIKLAMALAR' in c0:
                    continue
                if 'Not:' in c1 or 'Ders Programı' in c1 or 'Yükseköğretimde' in c1:
                    continue
                
                # If col0 is present and valid, update current_section
                if c0:
                    current_section = c0.replace('\n', ' ')
                
                # If both c1 and c2 are empty, skip
                if not c1 and not c2:
                    continue
                
                # Identify base course code and raw group
                # c1 might be like 'HEE2005-A', 'FİZ105-C [*]', 'BEÖ155'
                full_code_str = c1
                course_name_raw = c2.replace('\n', ' ').strip()
                group_col = str(r[3]).strip() if r[3] else ""
                
                # Check for special criteria flags in course code, name or group
                raw_combined = f"{c1} {c2} {group_col}"
                special_flags = []
                if '[***]' in raw_combined or '***' in raw_combined:
                    special_flags.append('***')
                elif '[**]' in raw_combined or '**' in raw_combined:
                    special_flags.append('**')
                elif '[*]' in raw_combined or '*' in raw_combined:
                    special_flags.append('*')
                
                bracket_notes = re.findall(r'\[([a-zA-Z])\]', raw_combined)
                for bn in bracket_notes:
                    special_flags.append(f"[{bn}]")
                
                # Clean base course code
                code_match = re.match(r'^([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s*[0-9]+)?)(?:-([A-Za-z0-9]+))?', full_code_str.split()[0])
                if code_match:
                    base_code = code_match.group(1).replace(' ', '')
                    extracted_grp = code_match.group(2) if code_match.group(2) else ""
                else:
                    base_code = full_code_str.split()[0]
                    extracted_grp = ""
                
                group = group_col if group_col else extracted_grp
                
                # Clean course name (remove [*], [**], etc.)
                clean_name = re.sub(r'\[.*?\]', '', course_name_raw).strip()
                clean_name = re.sub(r'\s+', ' ', clean_name)
                
                # Time slots across columns 4 to 9 (Pzt to Crt)
                time_slots = []
                for col_idx, day_info in DAY_COL_INDEXES.items():
                    val = str(r[col_idx]).strip() if r[col_idx] else ""
                    if val:
                        # Sometimes multiple slots in one day? e.g. separated by space or newline
                        parts = re.split(r'[\s\n]+', val)
                        for part in parts:
                            parsed_time = parse_time_slot(part)
                            if parsed_time:
                                start, end, disp = parsed_time
                                time_slots.append({
                                    "day": day_info["key"],
                                    "day_name": day_info["name"],
                                    "day_idx": day_info["day_idx"],
                                    "start": start,
                                    "end": end,
                                    "display": disp
                                })
                
                # Department & Semester mapping
                section_str = current_section if current_section else "ORTAK"
                dept = "ORTAK"
                sem_code = ""
                sem_label = "Ortak / Seçmeli Dersler"
                
                sec_match = re.match(r'^([A-Za-z]+)-?([1-4])', section_str)
                if sec_match:
                    dept = sec_match.group(1).upper()
                    sem_num = sec_match.group(2)
                    sem_code = f"{dept}-{sem_num}"
                    sem_label = SEMESTER_MAP.get(sem_num, f"{sem_num}. Yarıyıl")
                elif "Rektörlük" in section_str:
                    dept = "Rektörlük Seçmeli"
                    sem_code = "REKTORLUK"
                    sem_label = "Rektörlük Seçmeli Dersleri"
                
                dept_name = DEPARTMENT_MAP.get(dept, dept)
                
                # Parse credits
                credits_str = str(r[16]).strip() if r[16] else "0"
                credits_clean = credits_str.replace(',', '.')
                try:
                    credits_val = float(credits_clean)
                except ValueError:
                    credits_val = 0.0
                
                # Course type: Zorunlu, Seçmeli, Mes.Seç.
                type_str = str(r[13]).replace('\n', ' ').strip() if r[13] else "Zorunlu"
                is_compulsory = "Zorunlu" in type_str
                is_elective = not is_compulsory
                
                instructor = str(r[10]).replace('\n', ' ').strip() if r[10] else ""
                classroom = str(r[11]).replace('\n', ' ').strip() if r[11] else ""
                capacity = str(r[12]).replace('\n', ' ').strip() if r[12] else ""
                lang = str(r[14]).replace('\n', ' ').strip() if r[14] else "Tür"
                weekly_hours = str(r[15]).replace('\n', ' ').strip() if r[15] else ""
                
                # ID uniquely identifying this group offering
                course_id = f"{base_code}_{group}_{page_idx+1}" if group else f"{base_code}_{page_idx+1}"
                
                course_obj = {
                    "id": course_id,
                    "code": base_code,
                    "full_code": full_code_str,
                    "name": clean_name,
                    "group": group if group else "-",
                    "department": dept,
                    "department_name": dept_name,
                    "section": section_str,
                    "semester_code": sem_code,
                    "semester_label": sem_label,
                    "type": type_str,
                    "is_compulsory": is_compulsory,
                    "is_elective": is_elective,
                    "credits": credits_val,
                    "weekly_hours": weekly_hours,
                    "lang": lang,
                    "instructor": instructor,
                    "classroom": classroom,
                    "capacity": capacity,
                    "special_flags": special_flags,
                    "time_slots": time_slots,
                    "page": page_idx + 1
                }
                all_courses.append(course_obj)
    
    return all_courses

def build_catalog(courses):
    """
    Organizes courses into a hierarchical catalog:
    {
      "departments": [
        {
          "code": "HEE",
          "name": "Havacılık Elektrik ve Elektroniği",
          "semesters": [
            {
              "label": "7. Yarıyıl (Güz)",
              "code": "HEE-4",
              "courses": [
                {
                  "code": "HEE4007",
                  "name": "Uçak Gösterge Sistemleri I",
                  "is_compulsory": true,
                  "credits": 3.0,
                  "type": "Zorunlu",
                  "groups": [ ... ]
                }
              ]
            }
          ]
        }
      ]
    }
    """
    depts = {}
    
    for c in courses:
        dept = c["department"]
        sem = c["semester_label"]
        code = c["code"]
        
        if dept not in depts:
            depts[dept] = {
                "code": dept,
                "name": c["department_name"],
                "semesters": {}
            }
        
        if sem not in depts[dept]["semesters"]:
            depts[dept]["semesters"][sem] = {
                "label": sem,
                "code": c["semester_code"],
                "courses": {}
            }
        
        sem_courses = depts[dept]["semesters"][sem]["courses"]
        if code not in sem_courses:
            sem_courses[code] = {
                "code": code,
                "name": c["name"],
                "type": c["type"],
                "is_compulsory": c["is_compulsory"],
                "is_elective": c["is_elective"],
                "credits": c["credits"],
                "weekly_hours": c["weekly_hours"],
                "groups": []
            }
        
        # Add group offering
        sem_courses[code]["groups"].append(c)
    
    # Convert dict structures to sorted lists
    catalog_list = []
    # Department order
    ordered_dept_codes = ["HEE", "UGMB", "HY", "HTK", "PLT", "HUM", "Rektörlük Seçmeli", "ORTAK"]
    all_known_depts = [d for d in ordered_dept_codes if d in depts] + [d for d in depts if d not in ordered_dept_codes]
    
    for dcode in all_known_depts:
        ddata = depts[dcode]
        sem_list = []
        for slabel, sdata in ddata["semesters"].items():
            c_list = list(sdata["courses"].values())
            c_list.sort(key=lambda x: (not x["is_compulsory"], x["code"]))
            sem_list.append({
                "label": slabel,
                "code": sdata["code"],
                "courses": c_list
            })
        # Sort semesters (1. YY, 3. YY, 5. YY, 7. YY)
        sem_list.sort(key=lambda x: x["label"])
        catalog_list.append({
            "code": dcode,
            "name": ddata["name"],
            "semesters": sem_list
        })
        
    return {
        "departments": catalog_list,
        "all_courses": courses
    }

if __name__ == "__main__":
    pdf_file = "2026-2027 Güz Ders Programı.pdf"
    courses = parse_pdf(pdf_file)
    print(f"Parsed {len(courses)} course offerings from {pdf_file}")
    
    catalog = build_catalog(courses)
    
    output_path = "courses_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"Saved full catalog to {output_path}")
    
    # Also save to static/ if static directory exists
    import os
    os.makedirs("static", exist_ok=True)
    with open("static/courses_data.json", "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print("Saved catalog copy to static/courses_data.json")
