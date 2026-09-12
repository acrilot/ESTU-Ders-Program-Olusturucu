import itertools

EPSILON = 1e-5

def check_slots_overlap(slot1, slot2):
    """
    Returns True if slot1 and slot2 are on the same day and have overlapping hours.
    Each slot has 'day', 'start', 'end'.
    """
    if slot1["day"] != slot2["day"]:
        return False
    return max(slot1["start"], slot2["start"]) < min(slot1["end"], slot2["end"]) - EPSILON

def is_group_allowed_by_flags(group_obj, criteria):
    """
    Filters out groups with special flags unless explicitly allowed.
    Criteria keys: 'allow_star1', 'allow_star2', 'allow_star3', 'allow_brackets'
    """
    flags = group_obj.get("special_flags", [])
    if not flags:
        return True
    
    for flag in flags:
        if flag == '*' and not criteria.get("allow_star1", False):
            return False
        elif flag == '**' and not criteria.get("allow_star2", False):
            return False
        elif flag == '***' and not criteria.get("allow_star3", False):
            return False
        elif flag.startswith('[') and flag.endswith(']') and flag not in ['[*]', '[**]', '[***]']:
            if not criteria.get("allow_brackets", False):
                return False
    return True

def validate_schedule_criteria(assigned_groups, criteria):
    """
    Validates a complete schedule (list of group objects) against criteria:
    - allowed_days
    - earliest_start, latest_end
    - lunch_break (at least 30 min free between 11:30 and 14:00)
    - max_gap_hours
    """
    allowed_days = set(criteria.get("allowed_days", ["Pzt", "Sal", "Crs", "Prs", "Cum"]))
    earliest_start = float(criteria.get("earliest_start", 8.0))
    latest_end = float(criteria.get("latest_end", 20.0))
    require_lunch = criteria.get("require_lunch", True)
    lunch_min_hours = float(criteria.get("lunch_min_hours", 0.5)) # 30 mins
    max_gap_hours = criteria.get("max_gap_hours", None)
    if max_gap_hours is not None:
        max_gap_hours = float(max_gap_hours)
    
    # Collect slots by day
    day_slots = {}
    for grp in assigned_groups:
        for slot in grp.get("time_slots", []):
            d = slot["day"]
            # 1. Allowed days check
            if d not in allowed_days:
                return False, f"Ders günü izin verilen günler dışında: {d}"
            
            # 2. Time boundaries check
            if slot["start"] < earliest_start or slot["end"] > latest_end:
                return False, f"Ders saatleri sınırların dışında: {slot['display']}"
            
            if d not in day_slots:
                day_slots[d] = []
            day_slots[d].append(slot)
    
    # Check overlaps and daily constraints
    for d, slots in day_slots.items():
        # Sort slots by start time
        slots.sort(key=lambda s: s["start"])
        
        # Check overlaps
        for i in range(len(slots)):
            for j in range(i + 1, len(slots)):
                if check_slots_overlap(slots[i], slots[j]):
                    return False, f"{d} gününde çakışma: {slots[i]['start']}-{slots[i]['end']} ve {slots[j]['start']}-{slots[j]['end']}"
        
        # Check Lunch Break: Between 11:30 (11.5) and 14:00 (14.0)
        # If the student has classes spanning through this window, is there at least 30 min free?
        if require_lunch:
            window_start = 11.5
            window_end = 14.0
            
            # Has classes starting before 14:00 and ending after 11:30?
            overlapping_lunch = [s for s in slots if max(s["start"], window_start) < min(s["end"], window_end)]
            if overlapping_lunch:
                # Find busy intervals in [11.5, 14.0]
                busy_spans = []
                for s in overlapping_lunch:
                    bs = max(s["start"], window_start)
                    be = min(s["end"], window_end)
                    busy_spans.append((bs, be))
                busy_spans.sort()
                
                # Merge overlapping busy spans
                merged = []
                for bs, be in busy_spans:
                    if not merged or merged[-1][1] < bs:
                        merged.append([bs, be])
                    else:
                        merged[-1][1] = max(merged[-1][1], be)
                
                # Check free gaps in [11.5, 14.0]
                gaps = []
                cur = window_start
                for bs, be in merged:
                    if bs > cur:
                        gaps.append(bs - cur)
                    cur = max(cur, be)
                if cur < window_end:
                    gaps.append(window_end - cur)
                
                max_free_lunch = max(gaps) if gaps else 0.0
                if max_free_lunch < lunch_min_hours:
                    return False, f"{d} günü 11:30-14:00 arasında yeterli öğle molası ({lunch_min_hours*60:.0f} dk) yok"

        # Check Max Gap between consecutive classes on this day
        if max_gap_hours is not None and len(slots) > 1:
            for i in range(len(slots) - 1):
                gap = slots[i+1]["start"] - slots[i]["end"]
                if gap > max_gap_hours:
                    return False, f"{d} gününde dersler arası boşluk ({gap:.1f} saat) maksimum sınırı ({max_gap_hours:.1f}) aşıyor"
                    
    return True, "Uygun"

def calculate_schedule_metrics(assigned_groups):
    """
    Computes quality metrics:
    - total_credits
    - total_hours
    - total_gap_hours
    - active_days_count
    - efficiency_score (0-100)
    """
    day_slots = {}
    total_credits = 0.0
    total_hours = 0.0
    
    seen_codes = set()
    for grp in assigned_groups:
        if grp["code"] not in seen_codes:
            total_credits += grp.get("credits", 0.0)
            seen_codes.add(grp["code"])
            
        for slot in grp.get("time_slots", []):
            d = slot["day"]
            total_hours += (slot["end"] - slot["start"])
            if d not in day_slots:
                day_slots[d] = []
            day_slots[d].append(slot)
            
    total_gap_hours = 0.0
    for d, slots in day_slots.items():
        slots.sort(key=lambda s: s["start"])
        for i in range(len(slots) - 1):
            gap = max(0.0, slots[i+1]["start"] - slots[i]["end"])
            total_gap_hours += gap
            
    active_days_count = len(day_slots)
    
    # Priority penalty: C group is prioritized over D group in star courses
    star_group_penalty = 0.0
    for grp in assigned_groups:
        flags = grp.get("special_flags", [])
        if '*' in flags:
            g_letter = str(grp.get("group", "")).upper()
            if g_letter.startswith('C'):
                star_group_penalty += 2.0
            elif g_letter.startswith('D'):
                star_group_penalty += 8.0
            else:
                star_group_penalty += 4.0

    # Score calculation: baseline 100
    # Penalty for dead gap hours: -10 per hour
    # Penalty for active days: -5 per day
    score = 100.0 - (total_gap_hours * 10.0) - (active_days_count * 5.0) - star_group_penalty
    score = max(0.0, min(100.0, round(score, 1)))
    
    return {
        "total_credits": round(total_credits, 1),
        "total_hours": round(total_hours, 1),
        "total_gap_hours": round(total_gap_hours, 1),
        "active_days_count": active_days_count,
        "efficiency_score": score,
        "active_days": list(day_slots.keys())
    }

def solve_schedules(courses_with_groups, criteria, max_results=50):
    """
    Finds valid schedules for the selected courses.
    courses_with_groups: list of { 'code': str, 'name': str, 'groups': [group_obj, ...] }
    """
    allowed_days = set(criteria.get("allowed_days", ["Pzt", "Sal", "Crs", "Prs", "Cum"]))
    earliest_start = float(criteria.get("earliest_start", 8.0))
    latest_end = float(criteria.get("latest_end", 20.0))

    # 1. Filter candidate groups for each course
    filtered_courses = []
    for c in courses_with_groups:
        allowed_groups = []
        for g in c.get("groups", []):
            if not is_group_allowed_by_flags(g, criteria):
                continue
            
            # Early pruning: group must not have slots outside allowed days or bounds
            violates_limits = False
            for s in g.get("time_slots", []):
                if s["day"] not in allowed_days:
                    violates_limits = True
                    break
                if s["start"] < earliest_start - EPSILON or s["end"] > latest_end + EPSILON:
                    violates_limits = True
                    break
            if not violates_limits:
                allowed_groups.append(g)

        if not allowed_groups:
            # Cannot fulfill this course with allowed groups under current criteria!
            return []

        # Sort allowed groups: standard first, then alphabetical (A, B, C, D)
        def grp_sort_key(g):
            is_star = 1 if '*' in g.get("special_flags", []) else 0
            return (is_star, str(g.get("group", "")))
        allowed_groups.sort(key=grp_sort_key)
        filtered_courses.append(allowed_groups)
        
    valid_schedules = []
    
    # Sort course groups by number of candidates (MRV heuristic)
    filtered_courses.sort(key=lambda grps: len(grps))
    
    def backtrack(idx, current_schedule):
        if len(valid_schedules) >= max_results:
            return
        
        if idx == len(filtered_courses):
            valid, reason = validate_schedule_criteria(current_schedule, criteria)
            if valid:
                metrics = calculate_schedule_metrics(current_schedule)
                valid_schedules.append({
                    "groups": list(current_schedule),
                    "metrics": metrics
                })
            return
        
        for grp in filtered_courses[idx]:
            # Quick pairwise conflict check against current_schedule
            conflict = False
            for prev_grp in current_schedule:
                for s1 in grp.get("time_slots", []):
                    for s2 in prev_grp.get("time_slots", []):
                        if check_slots_overlap(s1, s2):
                            conflict = True
                            break
                    if conflict:
                        break
                if conflict:
                    break
                    
            if not conflict:
                current_schedule.append(grp)
                backtrack(idx + 1, current_schedule)
                current_schedule.pop()

    backtrack(0, [])
    
    # Sort valid schedules by efficiency score descending, then least gap hours
    valid_schedules.sort(key=lambda s: (s["metrics"]["efficiency_score"], -s["metrics"]["total_gap_hours"]), reverse=True)
    return valid_schedules

