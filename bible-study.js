(() => {
  const { weeks, spotify } = window.ftfStudy;
  const guestKey = 'ftf-study-progress-v1';
  const root = document.getElementById('study-weeks');
  const count = document.getElementById('study-count');
  const fill = document.getElementById('study-fill');
  const bar = document.getElementById('study-progress');
  const weekViews = [];
  let completed = new Set();

  function readSaved(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function lessonKey(week, day) {
    return `${week}:${day}`;
  }

  function renderProgress() {
    let finished = 0;
    let total = 0;
    for (const { counter, lessons } of weekViews) {
      let weekFinished = 0;
      for (const { id, checkbox } of lessons) {
        checkbox.checked = completed.has(id);
        weekFinished += Number(checkbox.checked);
      }
      counter.textContent = `${weekFinished} of ${lessons.length} complete`;
      total += lessons.length;
      finished += weekFinished;
    }
    document.getElementById('study-total').textContent = `${total} Daily Lessons`;
    count.textContent = `${finished} of ${total} lessons completed`;
    fill.style.width = `${total ? finished / total * 100 : 0}%`;
    bar.setAttribute('aria-valuemax', total);
    bar.setAttribute('aria-valuenow', finished);
  }

  window.ftfLoadGuestProgress = () => {
    const saved = readSaved(guestKey);
    if (Array.isArray(saved)) {
      completed = new Set(saved);
    } else {
      const old = readSaved('ftf-six-weeks-v9')?.days;
      const days = Array.isArray(old) ? old.slice(0, 30) : readSaved('ftf-week-one-v5')?.days?.slice(0, 5);
      completed = new Set((days || []).flatMap((done, index) =>
        done ? [lessonKey(Math.floor(index / 5) + 1, index % 5 + 1)] : []));
    }
    renderProgress();
  };

  window.ftfSetProgress = records => {
    completed = new Set(records.map(record => lessonKey(record.week_number, record.day_number)));
    renderProgress();
  };

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function renderWeek(week, number) {
    const section = element('details', '', 'week-detail');
    section.open = number === 1;
    const counter = element('p', '', 'week-progress');
    section.append(element('summary', `Week ${number} — ${week.title}`), counter);
    const lessons = week.lessons.map((lesson, index) => {
      const day = index + 1;
      const id = lessonKey(number, day);
      const detail = element('details', '', 'lesson-detail');
      const content = element('div', '', 'lesson-content');
      detail.append(element('summary', `Day ${day} — ${lesson.title}`), content);
      content.append(element('p', lesson.scripture ? `📖 Read: ${lesson.scripture}` :
        '📖 Scripture reading: See the corresponding lesson in your published workbook'));
      content.append(element('p', 'Reflect: What does this lesson teach you about God, and how will you apply it today?'));
      const listen = element('p');
      const link = element('a', '🎧 Listen on Spotify — choose an episode');
      link.href = spotify;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      listen.append(link);
      const label = element('label', '', 'day-row');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        const checked = checkbox.checked;
        if (checked) completed.add(id);
        else completed.delete(id);
        if (window.ftfCurrentUser) {
          window.dispatchEvent(new CustomEvent('ftf-progress-change', {
            detail: { week: number, day, completed: checked },
          }));
        } else {
          try {
            localStorage.setItem(guestKey, JSON.stringify([...completed]));
          } catch {
            // Progress remains available in memory for this visit.
          }
        }
        renderProgress();
      });
      label.append(checkbox, element('span', `Mark Day ${day} complete`));
      content.append(listen, label);
      section.append(detail);
      return { id, checkbox };
    });
    weekViews.push({ counter, lessons });
    root.append(section);
  }

  function loadPublishedContent(data) {
    const published = Array.isArray(data?.weeks) ? data.weeks : [];
    const seen = new Set();
    for (const week of published.slice().sort((a, b) => (a?.number || 0) - (b?.number || 0))) {
      if (!Number.isSafeInteger(week?.number) || week.number <= weeks.length || seen.has(week.number) ||
          typeof week.title !== 'string' || !week.title.trim() || !Array.isArray(week.lessons) ||
          !week.lessons.length || !week.lessons.every(lesson =>
            typeof lesson?.title === 'string' && lesson.title.trim() &&
            (lesson.scripture == null || typeof lesson.scripture === 'string'))) continue;
      renderWeek(week, week.number);
      seen.add(week.number);
    }
    renderProgress();
  }

  weeks.forEach((week, index) => renderWeek(week, index + 1));
  window.ftfLoadGuestProgress();
  fetch('./bible-study-content.json', { cache: 'no-cache' })
    .then(response => response.ok ? response.json() : null)
    .then(loadPublishedContent)
    .catch(() => {
      // The original weeks remain available if the published content cannot load.
    });
})();
