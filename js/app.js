
document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Logic
  const mobileNav = document.querySelector('.mobile-nav');
  const horizontalContainer = document.getElementById('horizontal-scroll-container');
  const hamburgerBtn = document.getElementById('hamburger-menu');
  const navMenuList = document.getElementById('nav-menu-list');

  // Find all sections that should be tracked
  const headers = Array.from(document.querySelectorAll('.general-header'));
  const sections = headers.map((header, index) => {
    // Add ID if missing for scrolling
    if (!header.id) {
      header.id = `section-${index}`;
    }
    return {
      element: header,
      title: header.outerText.trim()
    };
  });

  // Create Horizontal Menu Items
  sections.forEach((section, index) => {
    const item = document.createElement('div');
    item.classList.add('horizontal-item');
    item.textContent = section.title;
    item.dataset.index = index;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      handleManualScroll(index);
    });
    horizontalContainer.appendChild(item);
  });

  // Create Vertical Menu Items (for expanded state)
  sections.forEach((section, index) => {
    const item = document.createElement('div');
    item.classList.add('nav-menu-item');
    item.textContent = section.title;
    item.addEventListener('click', () => {
      handleManualScroll(index);
      toggleMenu(false);
    });
    navMenuList.appendChild(item);
  });

  let currentIndex = -1; // Force update on first run
  const horizontalItems = Array.from(horizontalContainer.children);
  let isManualScrolling = false;
  let scrollTimeout;

  function updateNav(index) {
    if (currentIndex === index) return;

    // Deactivate old
    if (currentIndex !== -1 && horizontalItems[currentIndex]) {
      horizontalItems[currentIndex].classList.remove('active');
    }

    currentIndex = index;
    const activeItem = horizontalItems[index];

    if (activeItem) {
      activeItem.classList.add('active');

      // Center item logic
      const containerWidth = horizontalContainer.offsetWidth;
      const itemLeft = activeItem.offsetLeft;
      const itemWidth = activeItem.offsetWidth;

      // Simple centering:
      const scrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);

      horizontalContainer.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  }

  function handleManualScroll(index) {
    // 1. "Lead" the scroll: Update UI immediately
    updateNav(index);

    // 2. Set flag to ignore scroll events temporarily
    isManualScrolling = true;
    clearTimeout(scrollTimeout);

    // 3. Scroll to section
    if (index >= 0 && index < sections.length) {
      const target = sections[index].element;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 4. Reset flag after estimation of scroll duration
    scrollTimeout = setTimeout(() => {
      isManualScrolling = false;
      // One final check in case we ended up somewhere else
      onScroll();
    }, 1000);
  }

  function onScroll() {
    if (isManualScrolling) return;

    // Improved detection: Find element closest to 20% down the viewport
    const detectOffset = window.innerHeight * 0.2;
    let closestIndex = 0;
    let currentBest = 0;
    for (let i = 0; i < sections.length; i++) {
      const rect = sections[i].element.getBoundingClientRect();
      if (rect.top <= detectOffset) {
        currentBest = i;
      } else {
        break;
      }
    }

    updateNav(currentBest);
  }

  // Throttled scroll listener
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  function toggleMenu(forceState) {
    if (typeof forceState === 'boolean') {
      if (forceState) mobileNav.classList.add('expanded');
      else mobileNav.classList.remove('expanded');
    } else {
      mobileNav.classList.toggle('expanded');
    }
  }

  hamburgerBtn.addEventListener('click', () => {
    toggleMenu();
  });

  // "View Full Schedule" Link
  const viewScheduleLink = document.querySelector('.view-schedule-link');
  if (viewScheduleLink) {
    viewScheduleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const scheduleSec = document.getElementById('schedule-section');
      if (scheduleSec) {
        scheduleSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Initialize
  onScroll();

  // =========================================================
  // Calendar / Next Session & Full Schedule Logic
  // =========================================================

  let cachedNextEvent = null;
  let cachedFullSchedule = [];
  let isFetching = false;

  // State for Desktop 1-week View
  let currentWeekOffset = 0;
  // State for mobile slider
  let mobileDayIndex = 0;
  let mobileFilteredDays = [];

  // Default Adaptive Bounds
  let minGridHour = 7;
  let maxGridHour = 21;

  try {
    const storedNext = localStorage.getItem('aviary_next_session');
    if (storedNext) cachedNextEvent = JSON.parse(storedNext);

    const storedFull = localStorage.getItem('aviary_full_schedule');
    if (storedFull) {
      cachedFullSchedule = JSON.parse(storedFull);
      renderFullSchedule(cachedFullSchedule);
    }
  } catch (e) {
    console.warn("Could not load cached event", e);
  }

  function getStartOfWeek(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  // 1. Fetch Data
  async function fetchSchedule() {
    if (isFetching) return;
    isFetching = true;

    // TODO: Paste your API Key here
    const API_KEY = 'AIzaSyCgYF0Mq1utMYsa6gzIozp3HI_7F6DEQuU';
    const CALENDAR_ID = '7hiluc30hvrplu268iqvbnnunc@group.calendar.google.com';

    if (API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
      const sessionCountdown = document.getElementById('session-countdown');
      if (sessionCountdown) sessionCountdown.textContent = "API Key Missing";
      return;
    }

    const now = new Date();
    const startOfWeek = getStartOfWeek(new Date(now));

    // Fetch 25 days
    const timeMin = startOfWeek.toISOString();
    const endDate = new Date(startOfWeek);
    endDate.setDate(endDate.getDate() + 25);
    const timeMax = endDate.toISOString();

    const params = new URLSearchParams({
      key: API_KEY,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      q: ''
    });

    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params.toString()}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const items = data.items || [];

      let nextSessionEvent = null;
      let minDiff = Infinity;

      for (const event of items) {
        const summary = (event.summary || "").toUpperCase();
        if (!summary.includes("OPEN")) continue;

        const start = new Date(event.start.dateTime || event.start.date);
        const diff = start - now;
        const diffMinutes = diff / (1000 * 60);

        if (diffMinutes > 0 && diff < minDiff) {
          minDiff = diff;
          nextSessionEvent = event;
        } else if (diffMinutes > -10 && diffMinutes <= 0) {
          nextSessionEvent = event;
          break;
        }
      }

      cachedNextEvent = nextSessionEvent;
      if (nextSessionEvent) {
        localStorage.setItem('aviary_next_session', JSON.stringify(nextSessionEvent));
      } else {
        localStorage.removeItem('aviary_next_session');
      }

      cachedFullSchedule = items;
      localStorage.setItem('aviary_full_schedule', JSON.stringify(items));

      updateCountdown();
      renderFullSchedule(items);
      updateCrowding();

    } catch (error) {
      console.error('Error fetching calendar:', error);
    } finally {
      isFetching = false;
    }
  }

  // 2. Update Countdown UI
  function updateCountdown() {
    const sessionCountdown = document.getElementById('session-countdown');
    const sessionStart = document.getElementById('session-start');
    const sessionEnd = document.getElementById('session-end');

    if (!sessionCountdown) return;

    if (!cachedNextEvent) {
      sessionCountdown.textContent = "No upcoming sessions found";
      sessionStart.textContent = "--";
      sessionEnd.textContent = "--";
      return;
    }

    const now = new Date();
    const event = cachedNextEvent;
    const startDate = new Date(event.start.dateTime || event.start.date);
    const endDate = new Date(event.end.dateTime || event.end.date);

    const diff = startDate - now;
    const diffMinutes = diff / (1000 * 60);

    if (diffMinutes > -10 && diffMinutes <= 0) {
      sessionCountdown.textContent = "Started just now";
      sessionStart.textContent = formatTime(startDate);
      sessionEnd.textContent = formatTime(endDate);
    } else if (diffMinutes > 0) {
      sessionStart.textContent = formatTime(startDate);
      sessionEnd.textContent = formatTime(endDate);

      const totalMinutes = Math.ceil(diff / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const minsStr = mins < 10 ? `0${mins}` : `${mins}`;

      const lastMin = sessionCountdown.dataset.lastMin;
      if (lastMin !== minsStr) {
        const animDigit = `<span class="anim-digit">${minsStr}</span>`;
        let timeContent = "";
        if (hours > 0) {
          timeContent = `${hours}h ${animDigit}m`;
        } else {
          timeContent = `${animDigit} min`;
        }
        sessionCountdown.innerHTML = `Starts in <span class="sunken-time">${timeContent}</span>`;
        sessionCountdown.dataset.lastMin = minsStr;
      }
    } else {
      if (diffMinutes < -10) {
        sessionCountdown.textContent = "Checking schedule...";
        cachedNextEvent = null;
      }
    }
  }

  // Crowd Logic with Closed Status
  function updateCrowding() {
    const crowdStatus = document.getElementById('crowd-status');
    const crowdIcon = document.getElementById('crowd-icon');
    const crowdDetails = document.getElementById('crowd-details');

    if (!crowdStatus || !crowdIcon || !crowdDetails) return;

    // Check if open now
    const now = new Date();
    let isOpen = false;
    let nextOpenTime = null;

    if (cachedFullSchedule.length > 0) {
      for (const event of cachedFullSchedule) {
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        if (now >= start && now < end) {
          isOpen = true;
          break;
        }
        // Find next open time if closed
        if (!isOpen && start > now && (!nextOpenTime || start < nextOpenTime)) {
          nextOpenTime = start;
        }
      }
    } else {
      isOpen = true; // Fallback
    }

    if (!isOpen) {
      crowdStatus.textContent = "No Active Session";
      crowdIcon.src = `img/closed.svg`;
      if (nextOpenTime) {
        const timeStr = formatTime(nextOpenTime);
        const dayStr = nextOpenTime.toLocaleDateString('en-US', { weekday: 'short' });
        if (nextOpenTime.toDateString() === now.toDateString()) {
          crowdDetails.textContent = "";
        } else {
          crowdDetails.textContent = `Opens ${dayStr} at ${timeStr}`;
        }
      } else {
        crowdDetails.textContent = "";
      }
      return;
    }

    const count = Math.floor(Math.random() * 19);

    let statusText = "";
    let iconName = "";

    if (count <= 0) {
      statusText = "Completely Empty";
      iconName = "0crowd.svg";
    } else if (count <= 3) {
      statusText = "A Couple Climbers";
      iconName = "0crowd.svg";
    } else if (count <= 7) {
      statusText = "Lots of Space";
      iconName = "1crowd.svg";
    } else if (count <= 14) {
      statusText = "Somewhat Busy";
      iconName = "2crowd.svg";
    } else if (count <= 17) {
      statusText = "Near Capacity";
      iconName = "3crowd.svg";
    } else {
      statusText = "⚠️ Completely Packed";
      iconName = "3crowd.svg";
    }

    const minutesAgo = Math.floor(Math.random() * 11);
    const updateTime = new Date(now.getTime() - minutesAgo * 60000);
    const timeString = formatTime(updateTime);

    crowdStatus.textContent = statusText;
    crowdIcon.src = `img/${iconName}`;
    crowdDetails.textContent = `${count} of 18 climbers as of ${timeString}`;
  }

  // =========================================================
  // Render Full Schedule Logic
  // =========================================================

  function calculateAdaptiveBounds(events, strict = false) {
    let minH = strict ? 24 : 7;
    let maxH = strict ? 0 : 21;

    if (!events || events.length === 0) return { minH: 7, maxH: 21 };

    let foundMin = 24;
    let foundMax = 0;
    let hasEvents = false;

    events.forEach(ev => {
      const start = new Date(ev.start.dateTime || ev.start.date);
      const end = new Date(ev.end.dateTime || ev.end.date);
      const startH = start.getHours();
      let endH = end.getHours();
      if (end.getMinutes() > 0) endH++;

      if (startH < foundMin) foundMin = startH;
      if (endH > foundMax) foundMax = endH;
      hasEvents = true;
    });

    if (hasEvents) {
      if (strict) {
        minH = foundMin;
        maxH = foundMax;
      } else {
        if (foundMin < minH) minH = foundMin;
        if (foundMax > maxH) maxH = foundMax;
      }
    } else {
      return { minH: 7, maxH: 21 };
    }
    if (maxH <= minH) maxH = minH + 6;
    return { minH, maxH };
  }

  // Draw Red Time Line (Restricted to Column)
  function drawTimeBar(gridContainer, startHour, colIndex) {
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    const floatTime = currentH + (currentM / 60);

    if (floatTime >= startHour) {
      const hoursFromStart = floatTime - startHour;
      const wholeRowIndex = 2 + Math.floor(hoursFromStart);
      const minuteOffsetPx = (currentM / 60) * 50;

      const bar = document.createElement('div');
      bar.className = 'current-time-bar';
      // Lock to specific column!
      bar.style.gridColumn = `${colIndex} / span 1`;
      bar.style.gridRow = wholeRowIndex;
      bar.style.top = `${minuteOffsetPx}px`;

      gridContainer.appendChild(bar);
    }
  }

  function renderFullSchedule(events, animateDirection = null) {
    const container = document.getElementById('schedule-section');
    if (!container) return;

    // If NOT animating, clear container. If animating, we operate inside existing logic or re-render?
    // For "Swipe", we want to animate the grid container (fade out/transform out), THEN update content, THEN transform in.
    // So this function should Render content. Animation handling should be separate or wrapping.

    // But wait, if I clear innerHTML, I kill the animation element.
    // The wrapper is `.week-container`.
    // Let's check if we are just re-rendering existing structure?
    // No, renderFullSchedule rebuilds DOM.

    // Simplified approach: Rebuild DOM immediately.
    // If animateDirection is passed ('next' or 'prev'), we should have *already* animated out?
    // Or we render, then animate in?

    container.innerHTML = "";

    const eventsByDay = {};
    events.forEach(event => {
      const start = new Date(event.start.dateTime || event.start.date);
      const dayStr = start.toDateString();
      if (!eventsByDay[dayStr]) eventsByDay[dayStr] = [];
      eventsByDay[dayStr].push(event);
    });

    const now = new Date();
    const startOfWeek = getStartOfWeek(new Date(now));

    // ... Week Data Generation (Same as before) ...
    const weekData = [];
    const rawMobileDays = [];
    for (let w = 0; w < 3; w++) {
      let mondayOfLoop = new Date(startOfWeek);
      mondayOfLoop.setDate(mondayOfLoop.getDate() + (w * 7));
      let sundayOfLoop = new Date(mondayOfLoop);
      sundayOfLoop.setDate(sundayOfLoop.getDate() + 6);

      let prefix = "";
      if (w === 0) prefix = "This Week";
      else if (w === 1) prefix = "Next Week";
      else prefix = "2 Weeks Out";

      const startStr = mondayOfLoop.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = sundayOfLoop.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const rangeStr = (mondayOfLoop.getMonth() === sundayOfLoop.getMonth())
        ? `${startStr} - ${sundayOfLoop.getDate()}`
        : `${startStr} - ${endStr}`;

      const weekObj = {
        label: `${prefix}: ${rangeStr}`,
        days: []
      };

      for (let d = 0; d < 5; d++) {
        const currentDay = new Date(mondayOfLoop);
        currentDay.setDate(currentDay.getDate() + d);
        const dayKey = currentDay.toDateString();
        const dayEvents = eventsByDay[dayKey] || [];
        dayEvents.sort((a, b) => {
          const dA = new Date(a.start.dateTime || a.start.date);
          const dB = new Date(b.start.dateTime || b.start.date);
          return dA - dB;
        });
        const dayObj = {
          date: currentDay,
          events: dayEvents
        };
        rawMobileDays.push(dayObj);
        weekObj.days.push(dayObj);
      }
      weekData.push(weekObj);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    mobileFilteredDays = rawMobileDays.filter(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      return dDate >= today;
    });
    if (mobileDayIndex >= mobileFilteredDays.length) mobileDayIndex = 0;

    // Desktop Render
    const currentWeekEvents = [];
    weekData[currentWeekOffset].days.forEach(d => currentWeekEvents.push(...d.events));
    // Strict = true for desktop now, to remove gaps!
    const desktopBounds = calculateAdaptiveBounds(currentWeekEvents, true);
    minGridHour = desktopBounds.minH;
    maxGridHour = desktopBounds.maxH;

    renderDesktopWeek(weekData[currentWeekOffset], container, weekData.length, animateDirection);

    // Mobile Render
    renderMobileView(container, animateDirection);
  }

  function getGridRow(hour, startHour) {
    return 2 + (hour - startHour);
  }

  function renderDesktopWeek(weekObj, container, totalWeeks, animateDirection) {
    const wrapper = document.createElement('div');
    wrapper.className = 'week-container desktop-view';

    const headerRow = document.createElement('div');
    headerRow.className = 'week-header-row';

    const label = document.createElement('h2');
    label.className = 'week-label';
    label.textContent = weekObj.label;

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '0.5rem';

    // Helpers for Navigation with Animation
    const goPrev = () => {
      if (currentWeekOffset > 0) {
        const grid = wrapper.querySelector('.schedule-grid-desktop');
        grid.classList.add('slide-out-right');
        setTimeout(() => {
          currentWeekOffset--;
          renderFullSchedule(cachedFullSchedule, 'prev');
        }, 300);
      }
    };

    const goNext = () => {
      if (currentWeekOffset < totalWeeks - 1) {
        const grid = wrapper.querySelector('.schedule-grid-desktop');
        grid.classList.add('slide-out-left');
        setTimeout(() => {
          currentWeekOffset++;
          renderFullSchedule(cachedFullSchedule, 'next');
        }, 300);
      }
    };

    const prevBtn = document.createElement('button');
    prevBtn.className = 'week-nav-btn';
    prevBtn.textContent = "← Prev";
    prevBtn.disabled = currentWeekOffset === 0;
    prevBtn.onclick = goPrev;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'week-nav-btn';
    nextBtn.textContent = "Next →";
    nextBtn.disabled = currentWeekOffset >= totalWeeks - 1;
    nextBtn.onclick = goNext;

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    headerRow.appendChild(label);
    headerRow.appendChild(controls);
    wrapper.appendChild(headerRow);

    const gridDiv = document.createElement('div');
    gridDiv.className = 'schedule-grid-desktop';

    // Apply "In" Animation if direction provided
    if (animateDirection === 'next') {
      gridDiv.classList.add('slide-in-right');
    } else if (animateDirection === 'prev') {
      gridDiv.classList.add('slide-in-left');
    }

    // Render Events
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    weekObj.days.forEach((dayObj, dayIndex) => {
      const col = dayIndex + 1;

      // Check if Today?
      const dDate = new Date(dayObj.date);
      dDate.setHours(0, 0, 0, 0);
      if (dDate.getTime() === today.getTime()) {
        // Draw RESTRICTED Time Bar
        drawTimeBar(gridDiv, minGridHour, col);
      }

      const header = document.createElement('div');
      header.className = 'schedule-header-cell';
      header.style.gridColumn = col;
      header.style.gridRow = 1;

      const dayName = dayObj.date.toLocaleDateString('en-US', { weekday: 'short' });
      const monName = dayObj.date.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dayObj.date.getDate();
      header.textContent = `${dayName} ${monName} ${dayNum}`;
      gridDiv.appendChild(header);

      dayObj.events.forEach(ev => {
        const start = new Date(ev.start.dateTime || ev.start.date);
        const end = new Date(ev.end.dateTime || ev.end.date);
        const startH = start.getHours();
        const endH = end.getHours();
        if (startH < minGridHour) return;
        const duration = Math.max(1, endH - startH);
        const rowStart = getGridRow(startH, minGridHour);
        const rowEnd = rowStart + duration;
        const card = createEventCard(ev);
        card.style.gridColumn = col;
        card.style.gridRowStart = rowStart;
        card.style.gridRowEnd = rowEnd;
        gridDiv.appendChild(card);
      });
    });

    wrapper.appendChild(gridDiv);
    container.appendChild(wrapper);
  }

  function createEventCard(ev) {
    const card = document.createElement('div');
    card.className = 'event-card';
    const summary = (ev.summary || "").toUpperCase();
    if (summary.includes("LESSON")) {
      card.classList.add('type-lesson');
    } else {
      card.classList.add('type-open');
    }
    const start = new Date(ev.start.dateTime || ev.start.date);
    const end = new Date(ev.end.dateTime || ev.end.date);
    const timeStr = `${formatTime(start)} - ${formatTime(end)}`;
    card.innerHTML = `
          <span class="event-time">${timeStr}</span>
          <h4 class="event-title">${ev.summary || "Event"}</h4>
      `;
    return card;
  }

  function renderMobileView(container, animateDirection) {
    const mobileWrapper = document.createElement('div');
    mobileWrapper.className = 'mobile-view';

    const controls = document.createElement('div');
    controls.className = 'mobile-controls';
    controls.style.position = 'relative';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'week-label';
    labelSpan.id = 'mob-range-label';
    labelSpan.style.textAlign = 'center';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'mobile-nav-btn';
    prevBtn.textContent = "←";
    prevBtn.id = 'mob-prev';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'mobile-nav-btn';
    nextBtn.textContent = "→";
    nextBtn.id = 'mob-next';

    controls.appendChild(prevBtn);
    controls.appendChild(labelSpan);
    controls.appendChild(nextBtn);

    mobileWrapper.appendChild(controls);

    const contentGrid = document.createElement('div');
    contentGrid.className = 'schedule-grid-mobile';

    // Animation In
    if (animateDirection === 'next') {
      contentGrid.classList.add('slide-in-right');
    } else if (animateDirection === 'prev') {
      contentGrid.classList.add('slide-in-left');
    }

    mobileWrapper.appendChild(contentGrid);
    container.appendChild(mobileWrapper);

    updateMobileContent(contentGrid, labelSpan);

    // --- Navigation Functions (Anim) ---
    const goMobilePrev = () => {
      if (mobileDayIndex > 0) {
        contentGrid.classList.add('slide-out-right');
        setTimeout(() => {
          mobileDayIndex -= 3;
          if (mobileDayIndex < 0) mobileDayIndex = 0;
          renderFullSchedule(cachedFullSchedule, 'prev');
        }, 300);
      }
    };

    const goMobileNext = () => {
      if (mobileDayIndex < mobileFilteredDays.length - 3) {
        contentGrid.classList.add('slide-out-left');
        setTimeout(() => {
          mobileDayIndex += 3;
          renderFullSchedule(cachedFullSchedule, 'next');
        }, 300);
      }
    };

    prevBtn.onclick = goMobilePrev;
    nextBtn.onclick = goMobileNext;

    prevBtn.disabled = mobileDayIndex <= 0;
    nextBtn.disabled = mobileDayIndex >= mobileFilteredDays.length - 3;

    // --- Touch Swipe Logic ---
    let touchStartX = 0;
    let touchEndX = 0;

    contentGrid.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    contentGrid.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const threshold = 50;
      if (touchEndX < touchStartX - threshold) {
        // Swipe Left -> Next
        if (!nextBtn.disabled) goMobileNext();
      }
      else if (touchEndX > touchStartX + threshold) {
        // Swipe Right -> Prev
        if (!prevBtn.disabled) goMobilePrev();
      }
    }
  }

  function updateMobileContent(grid, label) {
    grid.innerHTML = "";

    const day1 = mobileFilteredDays[mobileDayIndex];
    const day2 = mobileFilteredDays[mobileDayIndex + 1];
    const day3 = mobileFilteredDays[mobileDayIndex + 2];

    const visibleEvents = [];
    if (day1) visibleEvents.push(...day1.events);
    if (day2) visibleEvents.push(...day2.events);
    if (day3) visibleEvents.push(...day3.events);

    const mobBounds = calculateAdaptiveBounds(visibleEvents, true);
    const mobMin = mobBounds.minH;
    const mobMax = mobBounds.maxH;

    if (day1) {
      const d1Date = new Date(day1.date);
      const d1Str = d1Date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      let text = d1Str;

      let lastDay = day1;
      if (day3) lastDay = day3;
      else if (day2) lastDay = day2;

      if (lastDay !== day1) {
        const lastDate = new Date(lastDay.date);
        const lastStr = lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (d1Date.getMonth() === lastDate.getMonth()) {
          text = `${d1Str} - ${lastDate.getDate()}`;
        } else {
          text = `${d1Str} - ${lastStr}`;
        }
      }
      label.textContent = text;
    }

    // Render Mobile Headers & Events
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [day1, day2, day3];
    days.forEach((dayObj, i) => {
      if (!dayObj) return;
      const col = i + 1;

      // Render Header
      const header = document.createElement('div');
      header.className = 'mobile-header-cell';
      header.style.gridColumn = col;
      header.style.gridRow = 1;

      const dayName = dayObj.date.toLocaleDateString('en-US', { weekday: 'short' });
      const monName = dayObj.date.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dayObj.date.getDate();

      // E.g. "Mon \n Jan 27" or just "Mon Jan 27"
      // Let's use simple string
      header.textContent = `${dayName} ${monName} ${dayNum}`;
      grid.appendChild(header);

      // Render Events
      renderMobileColumn(grid, dayObj, col, mobMin);

      // Render Time Bar
      // Fix: Normalize date to midnight for comparison!
      const dDate = new Date(dayObj.date);
      dDate.setHours(0, 0, 0, 0);

      if (dDate.getTime() === today.getTime()) {
        drawTimeBar(grid, mobMin, col);
      }
    });
  }

  function renderMobileColumn(grid, dayObj, gridColumnIndex, startHour) {
    if (dayObj.events.length === 0) {
    } else {
      dayObj.events.forEach(ev => {
        const start = new Date(ev.start.dateTime || ev.start.date);
        const end = new Date(ev.end.dateTime || ev.end.date);

        const startH = start.getHours();
        const endH = end.getHours();
        const duration = Math.max(1, endH - startH);

        const rowStart = getGridRow(startH, startHour);
        const rowEnd = rowStart + duration;

        const card = createEventCard(ev);
        card.style.gridColumn = gridColumnIndex;
        card.style.gridRowStart = rowStart;
        card.style.gridRowEnd = rowEnd;

        grid.appendChild(card);
      });
    }
  }

  function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = hours + ':' + (minutes < 10 ? '0' + minutes : minutes);
    return strTime;
  }

  // Init
  fetchSchedule();
  setInterval(updateCountdown, 1000);
  setInterval(fetchSchedule, 60000 * 10);
  setInterval(updateCrowding, 60000);

});
