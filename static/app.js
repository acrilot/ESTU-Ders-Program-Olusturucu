// ESTÜ Ders Programı Hazırlama Otomasyonu - İstemci Motoru
let globalCatalog = null;
let allCoursesFlat = [];
let currentSchedules = [];
let currentScheduleIndex = 0;
let selectionMode = 'manual'; // 'manual' | 'auto'

const DAY_KEYS = ['Pzt', 'Sal', 'Crs', 'Prs', 'Cum'];
const DAY_NAMES = {
  'Pzt': 'Pazartesi',
  'Sal': 'Salı',
  'Crs': 'Çarşamba',
  'Prs': 'Perşembe',
  'Cum': 'Cuma'
};

// State Object loaded from / saved to localStorage
const appState = {
  selectedDept: localStorage.getItem('estu_dept') || '',
  selectedCourses: new Set(JSON.parse(localStorage.getItem('estu_selected_courses') || '[]')),
  passedCourses: new Set(JSON.parse(localStorage.getItem('estu_passed_courses') || '[]')),
  manualCourses: JSON.parse(localStorage.getItem('estu_manual_courses') || '[]'),
  theme: localStorage.getItem('estu_theme') || 'light',
  fontSize: localStorage.getItem('estu_font_size') || 'normal'
};

document.addEventListener('DOMContentLoaded', async () => {
  initUI();
  await loadCatalogData();
  restoreState();
});

// 1. UI Initialization
function initUI() {
  applyTheme(appState.theme);
  applyFontSize(appState.fontSize);

  // Sidebar navigation links
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
      // Close sidebar on mobile
      closeMobileSidebar();
    });
  });

  // Mobile menu toggle
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }

  // Quick theme toggle
  const quickThemeBtn = document.getElementById('quickThemeBtn');
  if (quickThemeBtn) {
    quickThemeBtn.addEventListener('click', () => {
      const next = appState.theme === 'light' ? 'dark' : 'light';
      changeTheme(next);
    });
  }

  // Department select change listener
  const deptSelect = document.getElementById('deptSelect');
  if (deptSelect) {
    deptSelect.addEventListener('change', (e) => {
      appState.selectedDept = e.target.value;
      localStorage.setItem('estu_dept', appState.selectedDept);
      renderCourseCatalog();
    });
  }

  // Electives checkbox
  const electivesCheck = document.getElementById('includeElectivesCheck');
  if (electivesCheck) {
    electivesCheck.addEventListener('change', () => {
      renderCourseCatalog();
    });
  }

  renderManualCoursesTable();
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

function switchView(viewName) {
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) targetSection.classList.add('active');

  const titles = {
    'generator': 'Ders Programı Hazırlama',
    'manual': 'Manuel Mod - Elle Ders Ekleme',
    'settings': 'Ayarlar ve Tercihler',
    'help': 'Kullanım Kılavuzu & Yardım'
  };
  const titleElem = document.getElementById('currentViewTitle');
  if (titleElem) titleElem.textContent = titles[viewName] || 'Ders Programı';
}

function changeTheme(theme) {
  appState.theme = theme;
  localStorage.setItem('estu_theme', theme);
  applyTheme(theme);
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) themeSelect.value = theme;
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function changeFontSize(size) {
  appState.fontSize = size;
  localStorage.setItem('estu_font_size', size);
  applyFontSize(size);
  const fontSelect = document.getElementById('fontSizeSelect');
  if (fontSelect) fontSelect.value = size;
}

function applyFontSize(size) {
  if (size === 'large') {
    document.documentElement.setAttribute('data-font-size', 'large');
  } else {
    document.documentElement.removeAttribute('data-font-size');
  }
}

function resetAllData() {
  if (confirm('Tüm kayıtlı tercihler, seçilen dersler ve manuel eklenen dersler silinecektir. Emin misiniz?')) {
    localStorage.clear();
    location.reload();
  }
}

// 2. Data Loading
async function loadCatalogData() {
  try {
    const res = await fetch('courses_data.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    globalCatalog = await res.json();
    allCoursesFlat = globalCatalog.all_courses || [];
    populateDepartmentDropdown();
  } catch (err) {
    console.error('Katalog yüklenirken hata oluştu:', err);
    document.getElementById('courseCatalogContainer').innerHTML = `
      <div style="padding: 20px; color: var(--danger); text-align: center;">
        Ders kataloğu verisi yüklenemedi. Sunucunun çalıştığından emin olunuz.
      </div>
    `;
  }
}

function populateDepartmentDropdown() {
  const deptSelect = document.getElementById('deptSelect');
  if (!deptSelect || !globalCatalog) return;

  deptSelect.innerHTML = '<option value="">Bölüm Seçiniz...</option>';
  globalCatalog.departments.forEach(dept => {
    if (dept.code !== 'Rektörlük Seçmeli' && dept.code !== 'ORTAK') {
      const opt = document.createElement('option');
      opt.value = dept.code;
      opt.textContent = `${dept.code} - ${dept.name}`;
      deptSelect.appendChild(opt);
    }
  });

  if (appState.selectedDept) {
    deptSelect.value = appState.selectedDept;
    renderCourseCatalog();
  }
}

function handlePdfUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Yalnızca ESTÜ ders programları geçerlidir.');
    event.target.value = '';
    return;
  }

  const statusElem = document.getElementById('pdfFileStatus');
  if (statusElem) statusElem.textContent = 'Yükleniyor ve ayrıştırılıyor...';

  const formData = new FormData();
  formData.append('file', file);

  fetch('/api/upload-pdf', {
    method: 'POST',
    body: formData
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(d => { throw new Error(d.error || 'Yükleme başarısız.'); });
    }
    return res.json();
  })
  .then(data => {
    if (data.catalog && data.catalog.departments) {
      globalCatalog = data.catalog;
      allCoursesFlat = globalCatalog.all_courses || [];
      appState.selectedDept = '';
      appState.selectedCourses.clear();
      appState.passedCourses.clear();
      populateDepartmentDropdown();
      const container = document.getElementById('courseCatalogContainer');
      if (container) container.innerHTML = '';
      if (statusElem) {
        statusElem.textContent = `Aktif: ${file.name} (${data.course_count} ders)`;
      }
      alert(`${file.name} yüklendi (${data.course_count} ders).`);
    } else {
      throw new Error('Ders tablosu bulunamadı.');
    }
  })
  .catch(err => {
    console.error('PDF upload error:', err);
    if (statusElem) {
      statusElem.textContent = 'Aktif: 2026-2027 Güz Dönemi (Yüklü)';
    }
    alert(err.message || 'Yalnızca ESTÜ ders programları geçerlidir.');
  })
  .finally(() => {
    event.target.value = '';
  });
}

function restoreState() {
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) themeSelect.value = appState.theme;

  const fontSelect = document.getElementById('fontSizeSelect');
  if (fontSelect) fontSelect.value = appState.fontSize;
}

// 3. Mode Toggle (Manual vs Auto)
function switchCourseSelectionMode(mode) {
  selectionMode = mode;
  document.getElementById('tabManualSelection').classList.toggle('active', mode === 'manual');
  document.getElementById('tabAutoSelection').classList.toggle('active', mode === 'auto');

  const autoPanel = document.getElementById('autoSelectionPanel');
  if (autoPanel) {
    autoPanel.style.display = mode === 'auto' ? 'block' : 'none';
  }

  const listHeader = document.getElementById('courseListHeader');
  if (listHeader) {
    if (mode === 'auto') {
      listHeader.firstElementChild.textContent = 'Daha Önce Başarıyla Alıp Geçtiğiniz Dersleri İşaretleyin';
    } else {
      listHeader.firstElementChild.textContent = 'Almak İstediğiniz Dersleri İşaretleyin';
    }
  }

  renderCourseCatalog();
}

// Calculate dynamic width based on the longest course title in the list
function calculateMaxCourseTitleWidth(items) {
  if (!items || items.length === 0) return 340;
  let maxWidth = 340;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '500 13.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    for (const item of items) {
      const name = item.name || '';
      if (name) {
        const w = ctx.measureText(name).width;
        if (w > maxWidth) maxWidth = w;
      }
    }
    return Math.ceil(maxWidth) + 28;
  } catch (e) {
    let maxChars = 40;
    for (const item of items) {
      const len = (item.name || '').length;
      if (len > maxChars) maxChars = len;
    }
    return Math.ceil(maxChars * 8.5) + 28;
  }
}

// 4. Render Course Catalog
function renderCourseCatalog() {
  const container = document.getElementById('courseCatalogContainer');
  const deptCode = appState.selectedDept;
  const includeElectives = document.getElementById('includeElectivesCheck')?.checked;

  if (!container || !globalCatalog) return;

  if (!deptCode) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 13.5px; padding: 20px; text-align: center;">
        Lütfen yukarıdaki menüden bölümünüzü seçiniz.
      </div>
    `;
    updateSelectedCountDisplay();
    return;
  }

  const dept = globalCatalog.departments.find(d => d.code === deptCode);
  if (!dept) return;

  // Gather all courses to calculate dynamic title width for mobile
  const allDeptCourses = [];
  (dept.semesters || []).forEach(sem => (sem.courses || []).forEach(c => allDeptCourses.push(c)));

  let electivesDept = null;
  if (includeElectives) {
    electivesDept = globalCatalog.departments.find(d => d.code === 'Rektörlük Seçmeli' || d.code === 'ORTAK');
    if (electivesDept) {
      (electivesDept.semesters || []).forEach(sem => (sem.courses || []).forEach(c => allDeptCourses.push(c)));
    }
  }

  const maxTitleW = calculateMaxCourseTitleWidth(allDeptCourses);
  const rowMinW = maxTitleW + 520;
  container.style.setProperty('--mobile-course-title-width', `${maxTitleW}px`);
  container.style.setProperty('--mobile-course-row-min-width', `${rowMinW}px`);

  let html = '';

  // Render department semesters
  dept.semesters.forEach((sem, sIdx) => {
    html += `
      <div class="semester-block">
        <div class="semester-header" onclick="toggleSemesterAccordion(this)">
          <span>${sem.label} (${sem.courses.length} Ders)</span>
          <span style="font-size: 12px;">▼</span>
        </div>
        <div class="semester-body">
          ${renderCourseListRows(sem.courses)}
        </div>
      </div>
    `;
  });

  // Render University / Electives if checked
  if (includeElectives && electivesDept) {
    electivesDept.semesters.forEach(sem => {
      html += `
        <div class="semester-block">
          <div class="semester-header" onclick="toggleSemesterAccordion(this)">
            <span>Ortak & Rektörlük Seçmeli Dersleri (${sem.courses.length} Ders)</span>
            <span style="font-size: 12px;">▼</span>
          </div>
          <div class="semester-body" style="display: none;">
            ${renderCourseListRows(sem.courses)}
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
  updateSelectedCountDisplay();
}

function renderCourseListRows(courses) {
  return courses.map(c => {
    const isChecked = selectionMode === 'auto' 
      ? appState.passedCourses.has(c.code)
      : appState.selectedCourses.has(c.code);

    const typeBadge = c.is_compulsory 
      ? `<span class="badge badge-zorunlu">Zorunlu</span>`
      : `<span class="badge badge-secmeli">Seçmeli</span>`;

    // Specific group flags
    let flagBadge = '';
    if (c.groups && c.groups.some(g => g.special_flags && g.special_flags.length > 0)) {
      const flags = new Set();
      c.groups.forEach(g => (g.special_flags || []).forEach(f => flags.add(f)));
      const flagLabels = [];
      if (flags.has('*')) flagLabels.push('[*] Kontenjan');
      if (flags.has('**')) flagLabels.push('[**] %30 İng');
      if (flags.has('***')) flagLabels.push('[***] Erasmus');
      flags.forEach(f => {
        if (f.startsWith('[') && !['[*]', '[**]', '[***]'].includes(f)) flagLabels.push(f);
      });
      flagBadge = `<span class="badge badge-flag" title="Özel Koşullu Şube Mevcut">${flagLabels.join(' ')}</span>`;
    }

    const groupCount = c.groups ? c.groups.length : 0;

    return `
      <div class="course-row">
        <div class="course-left">
          <input type="checkbox" class="course-checkbox" 
                 data-code="${c.code}" 
                 ${isChecked ? 'checked' : ''} 
                 onchange="handleCourseCheckboxChange(this, '${c.code}')">
          <span class="course-code">${c.code}</span>
          <div class="course-badges-group">
            ${typeBadge}
            ${flagBadge}
          </div>
          <span class="course-title" title="${c.name}">${c.name}</span>
        </div>
        <div class="course-meta">
          <span class="badge-akts">${c.credits} AKTS</span>
          <span>${groupCount} Grup</span>
        </div>
      </div>
    `;
  }).join('');
}

function toggleSemesterAccordion(headerElem) {
  const body = headerElem.nextElementSibling;
  const arrow = headerElem.querySelector('span:last-child');
  if (body.style.display === 'none') {
    body.style.display = 'flex';
    arrow.textContent = '▼';
  } else {
    body.style.display = 'none';
    arrow.textContent = '▶';
  }
}

function handleCourseCheckboxChange(checkbox, code) {
  if (selectionMode === 'auto') {
    if (checkbox.checked) {
      appState.passedCourses.add(code);
    } else {
      appState.passedCourses.delete(code);
    }
    localStorage.setItem('estu_passed_courses', JSON.stringify(Array.from(appState.passedCourses)));
  } else {
    if (checkbox.checked) {
      appState.selectedCourses.add(code);
    } else {
      appState.selectedCourses.delete(code);
    }
    localStorage.setItem('estu_selected_courses', JSON.stringify(Array.from(appState.selectedCourses)));
  }
  updateSelectedCountDisplay();
}

function updateSelectedCountDisplay() {
  const countElem = document.getElementById('selectedCoursesCount');
  if (!countElem) return;

  if (selectionMode === 'auto') {
    countElem.textContent = `${appState.passedCourses.size} ders geçildi olarak işaretlendi`;
  } else {
    countElem.textContent = `${appState.selectedCourses.size} ders seçildi`;
  }
}

// 5. Criteria Pills & Options
function toggleDayPill(pillElem) {
  pillElem.classList.toggle('selected');
}

function getCriteriaValues() {
  const selectedDays = [];
  document.querySelectorAll('.day-pill.selected').forEach(pill => {
    selectedDays.push(pill.getAttribute('data-day'));
  });

  const critLunch = document.getElementById('critLunchBreak').checked;
  const lunchDuration = parseFloat(document.getElementById('critLunchDuration').value || 0.5);
  const earliestStart = parseFloat(document.getElementById('critEarliestStart').value || 8.0);
  const latestEnd = parseFloat(document.getElementById('critLatestEnd').value || 20.0);
  const maxGap = document.getElementById('critMaxGap').value;
  const maxGapHours = maxGap === 'none' ? null : parseFloat(maxGap);

  const allowStar1 = document.getElementById('critStar1').checked;
  const allowStar2 = document.getElementById('critStar2').checked;
  const allowStar3 = document.getElementById('critStar3').checked;
  const allowBrackets = document.getElementById('critBrackets').checked;

  return {
    allowedDays: selectedDays,
    requireLunch: critLunch,
    lunchMinHours: lunchDuration,
    earliestStart: earliestStart,
    latestEnd: latestEnd,
    maxGapHours: maxGapHours,
    allowStar1: allowStar1,
    allowStar2: allowStar2,
    allowStar3: allowStar3,
    allowBrackets: allowBrackets
  };
}

// 6. Schedule Generation & Optimization Engine (Client-Side)
function handleGenerateSchedule() {
  if (!globalCatalog) {
    alert('Ders verisi henüz hazır değil.');
    return;
  }

  const criteria = getCriteriaValues();
  if (criteria.allowedDays.length === 0) {
    alert('Lütfen en az bir ders günü seçiniz.');
    return;
  }

  let targetCourses = [];

  if (selectionMode === 'manual') {
    // Mode 1: Manual selection by checked courses
    if (appState.selectedCourses.size === 0) {
      alert('Lütfen program oluşturmak için en az bir ders seçiniz.');
      return;
    }

    targetCourses = findCoursesByCodes(Array.from(appState.selectedCourses));
  } else {
    // Mode 2: Auto selection based on remaining unpassed courses and credit range
    const dept = globalCatalog.departments.find(d => d.code === appState.selectedDept);
    if (!dept) {
      alert('Lütfen önce bölümünüzü seçiniz.');
      return;
    }

    // Gather all department courses that user hasn't passed
    const unpassedDeptCourses = [];
    dept.semesters.forEach(s => {
      s.courses.forEach(c => {
        if (!appState.passedCourses.has(c.code)) {
          unpassedDeptCourses.push(c);
        }
      });
    });

    if (unpassedDeptCourses.length === 0) {
      alert('Bölümdeki tüm dersler geçilmiş olarak işaretlenmiş.');
      return;
    }

    const minCredits = parseFloat(document.getElementById('minTargetCredits').value || 25);
    const maxCredits = parseFloat(document.getElementById('maxTargetCredits').value || 35);
    const minElective = parseFloat(document.getElementById('minElectiveCredits').value || 0);

    // Pick courses prioritizing compulsory then electives until reaching target credits
    targetCourses = autoSelectCourses(unpassedDeptCourses, minCredits, maxCredits, minElective, criteria);
    if (targetCourses.length === 0) {
      alert('Belirtilen kredi aralığına uygun ders kombinasyonu bulunamadı. Lütfen kredi aralığını genişletiniz.');
      return;
    }
  }

  // Run Solver
  const solutions = solveClientSchedules(targetCourses, criteria, 50);

  if (solutions.length === 0) {
    alert('Belirlediğiniz kriterlere ve gün tercihlerine uygun çakışmasız ders programı bulunamadı.\n\nİpucu: Kriterleri esnetebilir (örneğin [*] gruplarını dahil edebilir veya gün sınırlarını genişletebilirsiniz).');
    document.getElementById('resultsCard').style.display = 'none';
    return;
  }

  currentSchedules = solutions;
  currentScheduleIndex = 0;
  displayCurrentSchedule();
  document.getElementById('resultsCard').style.display = 'block';
  document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth' });
}

function findCoursesByCodes(codes) {
  const result = [];
  const codeSet = new Set(codes);

  globalCatalog.departments.forEach(dept => {
    dept.semesters.forEach(sem => {
      sem.courses.forEach(c => {
        if (codeSet.has(c.code) && !result.some(r => r.code === c.code)) {
          result.push(c);
        }
      });
    });
  });

  return result;
}

function autoSelectCourses(availableCourses, minCredits, maxCredits, minElective, criteria) {
  const allowedDaysSet = criteria ? new Set(criteria.allowedDays) : null;
  const earliest = criteria ? (criteria.earliestStart || 8.0) : 8.0;
  const latest = criteria ? (criteria.latestEnd || 20.0) : 20.0;
  const EPSILON = 1e-5;

  function hasViableGroup(c) {
    if (!criteria) return true;
    return (c.groups || []).some(g => {
      if (!isGroupAllowed(g, criteria)) return false;
      for (const s of (g.time_slots || [])) {
        if (!allowedDaysSet.has(s.day)) return false;
        if (s.start < earliest - EPSILON || s.end > latest + EPSILON) return false;
      }
      return true;
    });
  }

  // Sort: Courses with viable groups first, then compulsory first, then higher credits
  const sorted = [...availableCourses].sort((a, b) => {
    const vA = hasViableGroup(a) ? 1 : 0;
    const vB = hasViableGroup(b) ? 1 : 0;
    if (vA !== vB) return vB - vA;
    if (a.is_compulsory && !b.is_compulsory) return -1;
    if (!a.is_compulsory && b.is_compulsory) return 1;
    return b.credits - a.credits;
  });

  const selected = [];
  let totalCreds = 0;
  let electiveCreds = 0;

  for (const c of sorted) {
    if (!hasViableGroup(c)) continue; // skip courses that cannot be scheduled under criteria

    if (totalCreds + c.credits <= maxCredits) {
      selected.push(c);
      totalCreds += c.credits;
      if (!c.is_compulsory) electiveCreds += c.credits;
    }
    if (totalCreds >= minCredits && electiveCreds >= minElective) {
      break;
    }
  }

  return selected;
}

// Client-Side Solver
function solveClientSchedules(courses, criteria, maxResults = 50) {
  const allowedDaysSet = new Set(criteria.allowedDays);
  const earliest = criteria.earliestStart || 8.0;
  const latest = criteria.latestEnd || 20.0;
  const EPSILON = 1e-5;

  // 1. Filter candidate groups for each course based on flags and day/hour limits
  const filteredCourses = [];
  for (const c of courses) {
    const allowedGroups = (c.groups || []).filter(g => {
      if (!isGroupAllowed(g, criteria)) return false;
      for (const s of (g.time_slots || [])) {
        if (!allowedDaysSet.has(s.day)) return false;
        if (s.start < earliest - EPSILON || s.end > latest + EPSILON) return false;
      }
      return true;
    });

    if (allowedGroups.length === 0) {
      return []; // impossible to schedule this course under current criteria
    }

    // Sort candidate groups: standard groups first, then C before D
    allowedGroups.sort((g1, g2) => {
      const g1IsStar = (g1.special_flags || []).includes('*');
      const g2IsStar = (g2.special_flags || []).includes('*');
      if (g1IsStar !== g2IsStar) return g1IsStar ? 1 : -1;
      return (g1.group || '').localeCompare(g2.group || '');
    });

    filteredCourses.push(allowedGroups);
  }

  // Sort courses by fewest group choices (MRV)
  filteredCourses.sort((a, b) => a.length - b.length);

  const solutions = [];

  function backtrack(index, currentAssignment) {
    if (solutions.length >= maxResults) return;

    if (index === filteredCourses.length) {
      const valid = validateScheduleClient(currentAssignment, criteria);
      if (valid) {
        const metrics = calculateMetricsClient(currentAssignment);
        solutions.push({
          groups: [...currentAssignment],
          metrics: metrics
        });
      }
      return;
    }

    for (const grp of filteredCourses[index]) {
      // Fast conflict check
      let hasConflict = false;
      for (const prev of currentAssignment) {
        for (const s1 of (grp.time_slots || [])) {
          for (const s2 of (prev.time_slots || [])) {
            if (s1.day === s2.day && Math.max(s1.start, s2.start) < Math.min(s1.end, s2.end) - EPSILON) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) break;
        }
        if (hasConflict) break;
      }

      if (!hasConflict) {
        currentAssignment.push(grp);
        backtrack(index + 1, currentAssignment);
        currentAssignment.pop();
      }
    }
  }

  backtrack(0, []);

  // Sort solutions by score descending
  solutions.sort((a, b) => b.metrics.score - a.metrics.score);
  return solutions;
}

function isGroupAllowed(group, criteria) {
  const flags = group.special_flags || [];
  if (flags.length === 0) return true;

  for (const f of flags) {
    if (f === '*' && !criteria.allowStar1) return false;
    if (f === '**' && !criteria.allowStar2) return false;
    if (f === '***' && !criteria.allowStar3) return false;
    if (f.startsWith('[') && f.endsWith(']') && !['[*]', '[**]', '[***]'].includes(f)) {
      if (!criteria.allowBrackets) return false;
    }
  }
  return true;
}

function validateScheduleClient(groups, criteria) {
  const allowedDaysSet = new Set(criteria.allowedDays);
  const daySlots = {};
  const EPSILON = 1e-5;

  for (const grp of groups) {
    for (const slot of (grp.time_slots || [])) {
      if (!allowedDaysSet.has(slot.day)) return false;
      if (slot.start < criteria.earliestStart - EPSILON || slot.end > criteria.latestEnd + EPSILON) return false;

      if (!daySlots[slot.day]) daySlots[slot.day] = [];
      daySlots[slot.day].push(slot);
    }
  }

  // Daily constraints
  for (const d of Object.keys(daySlots)) {
    const slots = daySlots[d];
    slots.sort((a, b) => a.start - b.start);

    // Overlap verification
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (Math.max(slots[i].start, slots[j].start) < Math.min(slots[i].end, slots[j].end) - EPSILON) {
          return false;
        }
      }
    }

    // Lunch check (11:30 - 14:00 at least lunchMinHours free)
    if (criteria.requireLunch) {
      const windowStart = 11.5;
      const windowEnd = 14.0;
      const lunchSlots = slots.filter(s => Math.max(s.start, windowStart) < Math.min(s.end, windowEnd));
      
      if (lunchSlots.length > 0) {
        // Merge busy intervals in [11.5, 14.0]
        const busy = lunchSlots.map(s => [Math.max(s.start, windowStart), Math.min(s.end, windowEnd)]).sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const [bs, be] of busy) {
          if (merged.length === 0 || merged[merged.length - 1][1] < bs) {
            merged.push([bs, be]);
          } else {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], be);
          }
        }

        let maxGap = 0;
        let cur = windowStart;
        for (const [bs, be] of merged) {
          if (bs > cur) maxGap = Math.max(maxGap, bs - cur);
          cur = Math.max(cur, be);
        }
        if (cur < windowEnd) maxGap = Math.max(maxGap, windowEnd - cur);

        if (maxGap < criteria.lunchMinHours) return false;
      }
    }

    // Max gap check
    if (criteria.maxGapHours !== null && slots.length > 1) {
      for (let i = 0; i < slots.length - 1; i++) {
        const gap = slots[i + 1].start - slots[i].end;
        if (gap > criteria.maxGapHours) return false;
      }
    }
  }

  return true;
}

function calculateMetricsClient(groups) {
  const daySlots = {};
  let totalCredits = 0;
  let totalHours = 0;
  const seenCodes = new Set();

  for (const grp of groups) {
    if (!seenCodes.has(grp.code)) {
      totalCredits += (grp.credits || 0);
      seenCodes.add(grp.code);
    }
    for (const slot of (grp.time_slots || [])) {
      totalHours += (slot.end - slot.start);
      if (!daySlots[slot.day]) daySlots[slot.day] = [];
      daySlots[slot.day].push(slot);
    }
  }

  let totalGapHours = 0;
  for (const d of Object.keys(daySlots)) {
    const slots = daySlots[d].sort((a, b) => a.start - b.start);
    for (let i = 0; i < slots.length - 1; i++) {
      totalGapHours += Math.max(0, slots[i + 1].start - slots[i].end);
    }
  }

  // Priority penalty: C group is prioritized over D group in star courses
  let starGroupPenalty = 0;
  for (const grp of groups) {
    const isStar = (grp.special_flags || []).includes('*');
    if (isStar) {
      const gLetter = (grp.group || '').toUpperCase();
      if (gLetter.startsWith('C')) {
        starGroupPenalty += 2; // small penalty for star group C
      } else if (gLetter.startsWith('D')) {
        starGroupPenalty += 8; // heavier penalty for D so C is strongly prioritized
      } else {
        starGroupPenalty += 4;
      }
    }
  }

  const activeDays = Object.keys(daySlots).length;
  let score = 100 - (totalGapHours * 10) - (activeDays * 5) - starGroupPenalty;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    credits: Math.round(totalCredits * 10) / 10,
    totalHours: totalHours,
    gapHours: Math.round(totalGapHours * 10) / 10,
    activeDays: activeDays,
    score: score
  };
}

// 7. Render Timetable & Results
function displayCurrentSchedule() {
  if (currentSchedules.length === 0) return;

  const sched = currentSchedules[currentScheduleIndex];
  const metrics = sched.metrics;

  // Update nav text
  document.getElementById('scheduleIndexText').textContent = `${currentScheduleIndex + 1} / ${currentSchedules.length}`;

  // Update summary metrics
  const summaryElem = document.getElementById('scheduleMetricsSummary');
  summaryElem.innerHTML = `
    <div class="metric-item metric-item-highlight">Toplam Kredi: <span class="metric-value-large">${metrics.credits} AKTS</span></div>
    <div class="metric-item">Verimlilik: <span class="metric-value">${metrics.score} / 100</span></div>
    <div class="metric-item">Aktif Gün: <span class="metric-value">${metrics.activeDays} Gün</span></div>
    <div class="metric-item">Dersler Arası Boşluk: <span class="metric-value">${metrics.gapHours} Saat</span></div>
  `;

  // Print subtitle
  const printSub = document.getElementById('printSubtitle');
  if (printSub) {
    printSub.textContent = `Toplam Kredi: ${metrics.credits} AKTS | Verimlilik Puanı: ${metrics.score} / 100 | Tarih: ${new Date().toLocaleDateString('tr-TR')}`;
  }

  // Build grid body (08:00 - 20:00) using rowspan for multi-hour blocks
  const tbody = document.getElementById('timetableBody');
  let gridHtml = '';

  const activeRowspans = { 'Pzt': 0, 'Sal': 0, 'Crs': 0, 'Prs': 0, 'Cum': 0 };

  for (let hour = 8; hour <= 19; hour++) {
    const timeLabel = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
    gridHtml += `<tr><td class="time-label">${timeLabel}</td>`;

    DAY_KEYS.forEach(day => {
      // If previous hour's rowspan covers this day, skip emitting <td>
      if (activeRowspans[day] > 0) {
        activeRowspans[day]--;
        return;
      }

      // Find if a course slot starts at this exact hour
      const matchingGrp = sched.groups.find(grp => {
        return (grp.time_slots || []).some(s => s.day === day && s.start === hour);
      });

      if (matchingGrp) {
        const slot = matchingGrp.time_slots.find(s => s.day === day && s.start === hour);
        const duration = Math.max(1, Math.round(slot.end - slot.start));
        activeRowspans[day] = duration - 1;

        const isStar = (matchingGrp.special_flags || []).includes('*');
        const starBadge = isStar ? `<span class="course-box-badge" style="background-color: #FEF2F2; color: #991B1B;">[*]</span>` : '';

        gridHtml += `
          <td class="slot-cell" rowspan="${duration}">
            <div class="course-box" style="min-height: ${(duration * 64) - 8}px;">
              <div class="course-box-top">
                <span class="course-box-title">${matchingGrp.code}</span>
                <div style="display: flex; gap: 4px; align-items: center;">
                  ${starBadge}
                  <span class="course-box-badge">${matchingGrp.group} Grubu</span>
                </div>
              </div>
              <div class="course-box-name">${matchingGrp.name}</div>
              <div class="course-box-details">
                <span>Derslik: ${matchingGrp.classroom || '-'}</span>
                ${matchingGrp.instructor ? `<span>Öğr: ${matchingGrp.instructor}</span>` : ''}
              </div>
              <div class="course-box-time">
                ${slot.display}
              </div>
            </div>
          </td>
        `;
      } else {
        gridHtml += `<td class="slot-cell"></td>`;
      }
    });

    gridHtml += `</tr>`;
  }
  tbody.innerHTML = gridHtml;

  // Build detail table below
  const listBody = document.getElementById('scheduleCoursesListBody');
  listBody.innerHTML = sched.groups.map(g => {
    const timeSlotsStr = (g.time_slots || []).map(s => `${DAY_NAMES[s.day] || s.day} ${s.display}`).join(', ');
    return `
      <tr>
        <td style="font-weight: 700;">${g.code}</td>
        <td>${g.name}</td>
        <td><strong>${g.group}</strong></td>
        <td>${timeSlotsStr}</td>
        <td>${g.classroom || '-'}</td>
        <td>${g.instructor || '-'}</td>
        <td><span class="badge-akts">${g.credits} AKTS</span></td>
      </tr>
    `;
  }).join('');
}

function prevSchedule() {
  if (currentScheduleIndex > 0) {
    currentScheduleIndex--;
    displayCurrentSchedule();
  }
}

function nextSchedule() {
  if (currentScheduleIndex < currentSchedules.length - 1) {
    currentScheduleIndex++;
    displayCurrentSchedule();
  }
}

// 8. Manuel Mod Actions
function handleManualAddCourse(event) {
  event.preventDefault();
  const code = document.getElementById('mCode').value.trim();
  const name = document.getElementById('mName').value.trim();
  const group = document.getElementById('mGroup').value.trim() || 'A';
  const type = document.getElementById('mType').value;
  const credits = parseFloat(document.getElementById('mCredits').value || 3.0);
  const classroom = document.getElementById('mClassroom').value.trim();
  const instructor = document.getElementById('mInstructor').value.trim();
  const day = document.getElementById('mDay').value;
  const startH = parseFloat(document.getElementById('mStartHour').value);
  const endH = parseFloat(document.getElementById('mEndHour').value);

  if (startH >= endH) {
    alert('Başlangıç saati bitiş saatinden küçük olmalıdır.');
    return;
  }

  const slot = {
    day: day,
    day_name: DAY_NAMES[day],
    start: startH,
    end: endH,
    display: `${startH.toString().padStart(2, '0')}:00 - ${endH.toString().padStart(2, '0')}:00`
  };

  const newCourse = {
    id: `MANUAL_${code}_${group}_${Date.now()}`,
    code: code,
    name: name,
    group: group,
    type: type,
    is_compulsory: type === 'Zorunlu',
    credits: credits,
    classroom: classroom,
    instructor: instructor,
    special_flags: [],
    time_slots: [slot]
  };

  appState.manualCourses.push(newCourse);
  localStorage.setItem('estu_manual_courses', JSON.stringify(appState.manualCourses));
  renderManualCoursesTable();
  document.getElementById('manualCourseForm').reset();
  alert(`${code} dersi manuel listeye eklendi.`);
}

function renderManualCoursesTable() {
  const tbody = document.getElementById('manualCoursesBody');
  const countElem = document.getElementById('manualCoursesCount');
  if (!tbody) return;

  if (countElem) countElem.textContent = appState.manualCourses.length;

  if (appState.manualCourses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 16px;">
          Henüz manuel ders eklenmedi.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = appState.manualCourses.map((c, idx) => {
    const slots = (c.time_slots || []).map(s => `${s.day_name} ${s.display}`).join(', ');
    return `
      <tr>
        <td style="font-weight: 700;">${c.code}</td>
        <td>${c.name}</td>
        <td>${c.group}</td>
        <td>${c.type}</td>
        <td><span class="badge-akts">${c.credits} AKTS</span></td>
        <td>${slots}</td>
        <td>${c.classroom || '-'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteManualCourse(${idx})">Sil</button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteManualCourse(index) {
  if (confirm('Bu dersi silmek istediğinizden emin misiniz?')) {
    appState.manualCourses.splice(index, 1);
    localStorage.setItem('estu_manual_courses', JSON.stringify(appState.manualCourses));
    renderManualCoursesTable();
  }
}

function clearManualCourses() {
  if (confirm('Tüm manuel dersler silinecektir. Emin misiniz?')) {
    appState.manualCourses = [];
    localStorage.setItem('estu_manual_courses', JSON.stringify([]));
    renderManualCoursesTable();
  }
}

function exportManualCoursesJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.manualCourses, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "estu_manuel_dersler.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importManualCoursesJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        appState.manualCourses = imported;
        localStorage.setItem('estu_manual_courses', JSON.stringify(appState.manualCourses));
        renderManualCoursesTable();
        alert(`${imported.length} adet ders başarıyla içe aktarıldı.`);
      } else {
        alert('Geçersiz JSON formatı.');
      }
    } catch (err) {
      alert('Dosya okunamadı: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function generateFromManualCourses() {
  if (appState.manualCourses.length === 0) {
    alert('Program oluşturmak için önce ders ekleyiniz.');
    return;
  }

  // Group manual courses by base code
  const grouped = {};
  appState.manualCourses.forEach(c => {
    if (!grouped[c.code]) {
      grouped[c.code] = {
        code: c.code,
        name: c.name,
        credits: c.credits,
        is_compulsory: c.is_compulsory,
        groups: []
      };
    }
    grouped[c.code].groups.push(c);
  });

  const coursesList = Object.values(grouped);
  const criteria = getCriteriaValues();
  const solutions = solveClientSchedules(coursesList, criteria, 50);

  if (solutions.length === 0) {
    alert('Manuel dersler arasında seçilen gün ve kriterlere uygun çakışmasız program bulunamadı.');
    return;
  }

  currentSchedules = solutions;
  currentScheduleIndex = 0;
  switchView('generator');
  displayCurrentSchedule();
  document.getElementById('resultsCard').style.display = 'block';
  document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth' });
}

// 9. Export Features (PNG, Excel, PDF)
function exportScheduleImage() {
  const exportArea = document.getElementById('scheduleExportArea') || document.getElementById('timetableContainer');
  if (!exportArea) {
    alert('Ders programı alanı bulunamadı.');
    return;
  }

  if (typeof html2canvas === 'undefined') {
    alert('Görsel kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz.');
    return;
  }

  // Find the button and show a loading feedback
  const exportBtns = document.querySelectorAll('.export-bar .btn');
  const pngBtn = exportBtns[0];
  const originalText = pngBtn ? pngBtn.innerHTML : '';
  if (pngBtn) {
    pngBtn.disabled = true;
    pngBtn.innerText = 'Görsel Hazırlanıyor...';
  }

  const requiredWidth = Math.max(exportArea.scrollWidth, 1150);

  html2canvas(exportArea, {
    scale: 2,
    backgroundColor: '#FFFFFF',
    logging: false,
    useCORS: true,
    windowWidth: requiredWidth + 100,
    onclone: (clonedDoc) => {
      const clonedArea = clonedDoc.getElementById('scheduleExportArea');
      if (clonedArea) {
        clonedArea.style.width = requiredWidth + 'px';
        clonedArea.style.maxWidth = 'none';
        clonedArea.style.overflow = 'visible';
        clonedArea.style.padding = '24px';
        clonedArea.style.backgroundColor = '#FFFFFF';
        clonedArea.style.boxSizing = 'border-box';
      }
      const clonedContainer = clonedDoc.getElementById('timetableContainer');
      if (clonedContainer) {
        clonedContainer.style.overflow = 'visible';
        clonedContainer.style.width = '100%';
      }
      const clonedGrid = clonedDoc.getElementById('timetableGrid');
      if (clonedGrid) {
        clonedGrid.style.minWidth = '1050px';
        clonedGrid.style.width = '100%';
      }
      const clonedDetails = clonedDoc.querySelector('.schedule-details-export .table-responsive');
      if (clonedDetails) {
        clonedDetails.style.overflow = 'visible';
        clonedDetails.style.width = '100%';
      }
    }
  }).then((canvas) => {
    const fileName = `ESTU_Ders_Programi_${new Date().toISOString().slice(0, 10)}.png`;

    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Görsel verisi oluşturulamadı.');
        if (pngBtn) {
          pngBtn.disabled = false;
          pngBtn.innerHTML = originalText;
        }
        return;
      }

      const isMobile = window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile && navigator.canShare) {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: 'ESTÜ Ders Programı',
              text: 'ESTÜ Ders Programı Çizelgesi'
            }).then(() => {
              if (pngBtn) {
                pngBtn.disabled = false;
                pngBtn.innerHTML = originalText;
              }
            }).catch((shareErr) => {
              console.log('Web Share API iptal edildi veya desteklenmiyor:', shareErr);
              triggerImageDownloadAndModal(blob, fileName, isMobile, pngBtn, originalText);
            });
            return;
          }
        } catch (shareErr) {
          console.log('Web Share API hatası:', shareErr);
        }
      }

      triggerImageDownloadAndModal(blob, fileName, isMobile, pngBtn, originalText);
    }, 'image/png');
  }).catch((err) => {
    console.error('PNG export error:', err);
    alert('Görsel oluşturulurken bir hata oluştu: ' + (err.message || err));
    if (pngBtn) {
      pngBtn.disabled = false;
      pngBtn.innerHTML = originalText;
    }
  });
}

function triggerImageDownloadAndModal(blob, fileName, isMobile, pngBtn, originalText) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = blobUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isMobile) {
    showImagePreviewModal(blobUrl, fileName);
  } else {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
  }

  if (pngBtn) {
    pngBtn.disabled = false;
    pngBtn.innerHTML = originalText;
  }
}

function showImagePreviewModal(imgUrl, fileName) {
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('imagePreviewImg');
  const downloadBtn = document.getElementById('imageDownloadBtn');
  if (modal && img) {
    img.src = imgUrl;
    if (downloadBtn) {
      downloadBtn.href = imgUrl;
      downloadBtn.download = fileName;
    }
    modal.style.display = 'flex';
  }
}

function closeImagePreviewModal() {
  const modal = document.getElementById('imagePreviewModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeImagePreviewModal();
  }
});

function exportScheduleExcel() {
  if (currentSchedules.length === 0) return;
  const sched = currentSchedules[currentScheduleIndex];

  if (typeof XLSX === 'undefined') {
    alert('Excel kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz.');
    return;
  }

  // Soft pastel color palette for courses
  const COURSE_PALETTES = [
    { bg: 'E0F2FE', border: '0284C7', text: '0369A1' }, // Sky Blue
    { bg: 'DCFCE7', border: '16A34A', text: '15803D' }, // Emerald
    { bg: 'FEF3C7', border: 'D97706', text: 'B45309' }, // Amber
    { bg: 'F3E8FF', border: '9333EA', text: '7E22CE' }, // Purple
    { bg: 'FFE4E6', border: 'E11D48', text: 'BE123C' }, // Rose
    { bg: 'E0E7FF', border: '4F46E5', text: '4338CA' }, // Indigo
    { bg: 'FFEDD5', border: 'EA580C', text: 'C2410C' }, // Orange
    { bg: 'CCFBF1', border: '0D9488', text: '0F766E' }, // Teal
    { bg: 'FCE7F3', border: 'DB2777', text: 'BE185D' }, // Pink
    { bg: 'F1F5F9', border: '475569', text: '334155' }  // Slate
  ];

  const courseColorMap = {};
  sched.groups.forEach((g) => {
    if (!courseColorMap[g.code]) {
      const pIdx = Object.keys(courseColorMap).length % COURSE_PALETTES.length;
      courseColorMap[g.code] = COURSE_PALETTES[pIdx];
    }
  });

  // Build cell data map for Sheet 1 (Ders Programı)
  const wsMain = {};
  const merges = [];
  const rowHeights = [];

  // Helper to set cell with style
  function setCell(r, c, val, style) {
    const ref = XLSX.utils.encode_cell({ r, c });
    wsMain[ref] = { t: typeof val === 'number' ? 'n' : 's', v: val, s: style };
  }

  // Row 0: Title Banner
  const titleStyle = {
    font: { name: 'Segoe UI', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '911F10' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  for (let c = 0; c <= 5; c++) {
    setCell(0, c, c === 0 ? "ESKİŞEHİR TEKNİK ÜNİVERSİTESİ - HAFTALIK DERS PROGRAMI" : "", titleStyle);
  }
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
  rowHeights.push({ hpt: 32 });

  // Row 1: Subtitle Info
  const subtitleText = `Toplam Kredi: ${sched.metrics.credits} AKTS   |   Verimlilik Puanı: ${sched.metrics.score} / 100   |   Tarih: ${new Date().toLocaleDateString('tr-TR')}`;
  const subtitleStyle = {
    font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: '7F1D1D' } },
    fill: { fgColor: { rgb: 'FDF2F2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: 'FCA5A5' } }
    }
  };
  for (let c = 0; c <= 5; c++) {
    setCell(1, c, c === 0 ? subtitleText : "", subtitleStyle);
  }
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
  rowHeights.push({ hpt: 20 });

  // Row 2: Spacer
  for (let c = 0; c <= 5; c++) {
    setCell(2, c, "", {});
  }
  rowHeights.push({ hpt: 8 });

  // Row 3: Timetable Column Headers
  const ttHeaders = ["Saat / Gün", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const headerStyle = {
    font: { name: 'Segoe UI', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '7A1A0D' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '551109' } },
      bottom: { style: 'medium', color: { rgb: '551109' } },
      left: { style: 'thin', color: { rgb: '991B1B' } },
      right: { style: 'thin', color: { rgb: '991B1B' } }
    }
  };
  ttHeaders.forEach((th, c) => {
    setCell(3, c, th, headerStyle);
  });
  rowHeights.push({ hpt: 26 });

  // Rows 4 to 15: Hours 8 to 19
  const timeColStyle = {
    font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '374151' } },
    fill: { fgColor: { rgb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } }
    }
  };

  const emptySlotStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } }
    }
  };

  for (let h = 8; h <= 19; h++) {
    const r = 4 + (h - 8);
    const timeLabel = `${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00`;
    setCell(r, 0, timeLabel, timeColStyle);

    DAY_KEYS.forEach((day, dayIdx) => {
      const c = dayIdx + 1;
      const match = sched.groups.find(grp => {
        return (grp.time_slots || []).some(s => s.day === day && s.start <= h && s.end >= (h + 1));
      });

      if (match) {
        const p = courseColorMap[match.code] || COURSE_PALETTES[0];
        const cellText = `${match.code} (${match.group})\n${match.name}\n${match.classroom ? 'Derslik: ' + match.classroom : '-'}${match.instructor ? ' | ' + match.instructor : ''}`;
        const courseStyle = {
          font: { name: 'Segoe UI', sz: 8.5, bold: false, color: { rgb: p.text } },
          fill: { fgColor: { rgb: p.bg } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: p.border } },
            bottom: { style: 'thin', color: { rgb: p.border } },
            left: { style: 'medium', color: { rgb: p.border } },
            right: { style: 'thin', color: { rgb: p.border } }
          }
        };
        setCell(r, c, cellText, courseStyle);
      } else {
        setCell(r, c, "", emptySlotStyle);
      }
    });

    rowHeights.push({ hpt: 48 });
  }

  // Row 16: Spacer
  for (let c = 0; c <= 6; c++) {
    setCell(16, c, "", {});
  }
  rowHeights.push({ hpt: 12 });

  // Row 17: Details Title
  const detailsTitleStyle = {
    font: { name: 'Segoe UI', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '911F10' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  for (let c = 0; c <= 6; c++) {
    setCell(17, c, c === 0 ? " PROGRAMDA YER ALAN GRUPLAR VE DERSLİKLER" : "", detailsTitleStyle);
  }
  merges.push({ s: { r: 17, c: 0 }, e: { r: 17, c: 6 } });
  rowHeights.push({ hpt: 24 });

  // Row 18: Details Headers
  const dtHeaders = ["Ders Kodu", "Ders Adı", "Grup", "Gün ve Saatler", "Derslik", "Öğretim Elemanı", "Kredi (AKTS)"];
  const detailsHeaderStyle = {
    font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '7A1A0D' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '551109' } },
      bottom: { style: 'medium', color: { rgb: '551109' } },
      left: { style: 'thin', color: { rgb: '991B1B' } },
      right: { style: 'thin', color: { rgb: '991B1B' } }
    }
  };
  dtHeaders.forEach((dh, c) => {
    setCell(18, c, dh, detailsHeaderStyle);
  });
  rowHeights.push({ hpt: 22 });

  // Rows 19+: Details rows
  sched.groups.forEach((g, gIdx) => {
    const r = 19 + gIdx;
    const isEven = gIdx % 2 === 0;
    const bg = isEven ? 'FFFFFF' : 'F9FAFB';
    const border = {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } }
    };

    const timeSlotsStr = (g.time_slots || []).map(s => `${DAY_NAMES[s.day] || s.day} ${s.display}`).join(', ');

    setCell(r, 0, g.code, { font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '111827' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border });
    setCell(r, 1, g.name, { font: { name: 'Segoe UI', sz: 9, color: { rgb: '111827' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', vertical: 'center' }, border });
    setCell(r, 2, g.group, { font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '111827' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border });
    setCell(r, 3, timeSlotsStr, { font: { name: 'Segoe UI', sz: 8.5, color: { rgb: '374151' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', vertical: 'center' }, border });
    setCell(r, 4, g.classroom || '-', { font: { name: 'Segoe UI', sz: 9, color: { rgb: '374151' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border });
    setCell(r, 5, g.instructor || '-', { font: { name: 'Segoe UI', sz: 8.5, color: { rgb: '374151' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', vertical: 'center' }, border });
    setCell(r, 6, g.credits, { font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '111827' } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border });

    rowHeights.push({ hpt: 22 });
  });

  const totalRows = 19 + sched.groups.length;
  wsMain['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: 6 } });
  wsMain['!merges'] = merges;
  wsMain['!rows'] = rowHeights;
  wsMain['!cols'] = [
    { wch: 17 }, // Saat / Ders Kodu
    { wch: 28 }, // Pazartesi / Ders Adı
    { wch: 28 }, // Salı / Grup
    { wch: 28 }, // Çarşamba / Gün ve Saatler
    { wch: 28 }, // Perşembe / Derslik
    { wch: 28 }, // Cuma / Öğretim Elemanı
    { wch: 14 }  // Kredi
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMain, "Ders Programı");

  // Sheet 2: Standalone Course List
  const wsList = {};
  const listHeaders = ["Ders Kodu", "Ders Adı", "Grup", "Türü", "Kredi (AKTS)", "Derslik", "Öğretim Elemanı", "Saatler"];
  const listHeaderStyle = {
    font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '911F10' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '7F1D1D' } },
      bottom: { style: 'medium', color: { rgb: '7F1D1D' } },
      left: { style: 'thin', color: { rgb: '7F1D1D' } },
      right: { style: 'thin', color: { rgb: '7F1D1D' } }
    }
  };

  listHeaders.forEach((lh, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    wsList[ref] = { t: 's', v: lh, s: listHeaderStyle };
  });

  const listRowHeights = [{ hpt: 24 }];
  sched.groups.forEach((g, gIdx) => {
    const r = gIdx + 1;
    const isEven = gIdx % 2 === 0;
    const bg = isEven ? 'FFFFFF' : 'F9FAFB';
    const border = {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } }
    };
    const timeSlotsStr = (g.time_slots || []).map(s => `${DAY_NAMES[s.day] || s.day} ${s.display}`).join(', ');

    const rowData = [
      { v: g.code, bold: true, align: 'center' },
      { v: g.name, bold: false, align: 'left' },
      { v: g.group, bold: true, align: 'center' },
      { v: g.type, bold: false, align: 'center' },
      { v: g.credits, bold: true, align: 'center' },
      { v: g.classroom || '-', bold: false, align: 'center' },
      { v: g.instructor || '-', bold: false, align: 'left' },
      { v: timeSlotsStr, bold: false, align: 'left' }
    ];

    rowData.forEach((item, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      wsList[ref] = {
        t: typeof item.v === 'number' ? 'n' : 's',
        v: item.v,
        s: {
          font: { name: 'Segoe UI', sz: 9, bold: item.bold, color: { rgb: '111827' } },
          fill: { fgColor: { rgb: bg } },
          alignment: { horizontal: item.align, vertical: 'center' },
          border
        }
      };
    });

    listRowHeights.push({ hpt: 20 });
  });

  wsList['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sched.groups.length, c: 7 } });
  wsList['!rows'] = listRowHeights;
  wsList['!cols'] = [
    { wch: 14 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 26 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, wsList, "Ders Listesi");

  XLSX.writeFile(wb, `ESTU_Ders_Programi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportSchedulePDF() {
  closeImagePreviewModal();
  window.print();
}
